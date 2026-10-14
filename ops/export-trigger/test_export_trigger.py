#!/usr/bin/env python3
"""Dry-run harness for abentertainment-export-trigger: the whole tick (fetch, check, runs, decision, dispatch, state, log)
against a fake backend, plus the pure decision matrix. Run: python3 -B ops/export-trigger/test_export_trigger.py"""
import importlib.machinery
import importlib.util
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = tempfile.mkdtemp(prefix="abent-et-test-")
os.environ.update(ET_LOG_FILE=os.path.join(TMP, "trigger.log"), ET_STATE_DIR=os.path.join(TMP, "state"), ET_LOCK_FILE=os.path.join(TMP, "lock"))
loader = importlib.machinery.SourceFileLoader("export_trigger", os.path.join(HERE, "abentertainment-export-trigger"))
spec = importlib.util.spec_from_loader("export_trigger", loader)
et = importlib.util.module_from_spec(spec)
loader.exec_module(et)

BASE = 1_800_000_000.0


def run(i, status, conclusion, event, age, sha=None):
    return {"databaseId": i, "status": status, "conclusion": conclusion, "event": event, "createdAt": et.now_iso(BASE - age), "updatedAt": et.now_iso(BASE - age + 60), "headSha": sha or ("%040d" % i)}


class FakeBackend:
    def __init__(self, stale=True, runs=None, tip_age=7200, check_ok=True, is_bot=False):
        self.stale, self.run_list, self.check_ok = stale, runs or [], check_ok
        self.tip = {"sha": "a" * 40, "committed_at": BASE - tip_age, "is_bot": is_bot}
        self.dispatched = 0
        self.record = {"source": "1" * 40, "data": "2" * 40, "inputs": "3" * 64}

    def fetch_tip(self):
        return self.tip

    def recorded(self):
        return self.record

    def check(self, recorded):
        if not self.check_ok:
            return None
        return {"needs_build": self.stale, "counts": "{}", "data": "2" * 12 if not self.stale else "f" * 12, "source": "1" * 12, "inputs": "9" * 12}

    def runs(self):
        return self.run_list

    def dispatch(self):
        self.dispatched += 1


class Decision(unittest.TestCase):
    def test_pure_logic(self):
        et.self_test()


class Tick(unittest.TestCase):
    def setUp(self):
        if os.path.exists(et.LOG_FILE):
            os.remove(et.LOG_FILE)

    def log_text(self):
        return open(et.LOG_FILE, encoding="utf-8").read() if os.path.exists(et.LOG_FILE) else ""

    def test_admin_data_change_dispatches_once_and_logs_the_reason(self):
        backend, state = FakeBackend(), {}
        action, reason = et.tick(backend, state, now=BASE)
        self.assertEqual((action, backend.dispatched), ("dispatch", 1))
        self.assertIn("live data changed", reason)
        self.assertIn("DISPATCHED build-export.yml (commit=true)", self.log_text())
        self.assertEqual(state["dispatched_against"], "3" * 64)

    def test_dry_run_never_dispatches(self):
        backend = FakeBackend()
        action, _ = et.tick(backend, {}, dry_run=True, now=BASE)
        self.assertEqual((action, backend.dispatched), ("dispatch", 0))
        self.assertIn("DRY-RUN would dispatch", self.log_text())

    def test_up_to_date_is_quiet_and_resets_the_counters(self):
        backend, state = FakeBackend(stale=False), {"no_progress": 2, "dispatched_against": "x"}
        for step in range(5):
            self.assertEqual(et.tick(backend, state, now=BASE + 180 * step)[0], "idle")
        self.assertEqual(self.log_text().count("up to date"), 1, "an unchanged state is logged once an hour, not at every tick")
        self.assertEqual((state["no_progress"], backend.dispatched), (0, 0))

    def test_a_running_build_blocks_a_second_dispatch(self):
        backend = FakeBackend(runs=[run(7, "in_progress", None, "workflow_dispatch", 60)])
        self.assertEqual(et.tick(backend, {}, now=BASE)[0], "skip")
        self.assertEqual(backend.dispatched, 0)

    def test_the_failed_export_of_a_push_is_re_dispatched_after_the_back_off(self):
        failed = run(9, "completed", "failure", "push", 900, sha="a" * 40)   # run 38507160035 for a46b55d3 looked like this
        backend = FakeBackend(runs=[failed], tip_age=1000)
        action, reason = et.tick(backend, {}, now=BASE)
        self.assertEqual(action, "dispatch")
        self.assertIn("retry after 1 failed build", reason)
        soon = FakeBackend(runs=[run(9, "completed", "failure", "push", 100, sha="a" * 40)], tip_age=1000)
        self.assertEqual(et.tick(soon, {}, now=BASE)[0], "skip")

    def test_a_check_that_cannot_reach_the_api_skips_quietly(self):
        backend = FakeBackend(check_ok=False)
        self.assertEqual(et.tick(backend, {}, now=BASE)[0], "skip")
        self.assertEqual(backend.dispatched, 0)

    def test_a_successful_build_that_leaves_the_export_stale_backs_off(self):
        done = run(11, "completed", "success", "workflow_dispatch", 300)
        backend, state = FakeBackend(runs=[done]), {"dispatched_against": "3" * 64, "last_dispatch_at": BASE - 300}
        action, why = et.tick(backend, state, now=BASE)
        self.assertEqual(state["no_progress"], 1, "the record on main did not change after the successful run")
        self.assertEqual(action, "dispatch", "one fruitless build backs off 5 minutes from the dispatch; 300 s have passed")
        quick = FakeBackend(runs=[run(12, "completed", "success", "workflow_dispatch", 250)])
        again = {"dispatched_against": "3" * 64, "last_dispatch_at": BASE - 250}
        self.assertEqual(et.tick(quick, again, now=BASE)[0], "skip", "only 250 s after the fruitless build: still backing off")
        self.assertEqual(quick.dispatched, 0)

    def test_the_hourly_cap_holds(self):
        backend = FakeBackend(runs=[run(20 + i, "completed", "success", "workflow_dispatch", 500 * (i + 1)) for i in range(6)])
        action, reason = et.tick(backend, {}, now=BASE)
        self.assertEqual(action, "skip")
        self.assertIn("cap 6", reason)


if __name__ == "__main__":
    unittest.main(verbosity=2)
