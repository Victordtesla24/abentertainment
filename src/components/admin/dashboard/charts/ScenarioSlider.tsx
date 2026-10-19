'use client';

import { COLOR, WHITE } from '../brand';
import { SCENARIOS, type Scenario } from './series';

/**
 * The scenario the forecast is read under: a slider with three stops, low, expected and high. It picks which of the model's own three figures
 * the line and the headline show; it never works out a figure of its own (there is nothing between its stops). The thumb is a gold disc with
 * the brand's focus ring, and on a touch screen the slider is as tall as a finger. It is a named control: its words are its name and its value.
 */

const STYLE = `
.ab-scenario{-webkit-appearance:none;appearance:none;background:transparent;margin:0;width:100%;height:44px;cursor:pointer}
.ab-scenario::-webkit-slider-runnable-track{height:2px;background:${WHITE.a25};border:0}
.ab-scenario::-moz-range-track{height:2px;background:${WHITE.a25};border:0}
.ab-scenario::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin-top:-9px;border-radius:50%;background:${COLOR.gold};border:2px solid ${COLOR.black};box-shadow:0 0 0 1px ${COLOR.gold}}
.ab-scenario::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:${COLOR.gold};border:2px solid ${COLOR.black};box-shadow:0 0 0 1px ${COLOR.gold}}
`;

export function ScenarioSlider({ value, onChange, words, testId }: { value: Scenario; onChange: (value: Scenario) => void; words: readonly [string, string, string]; testId: string }) {
  const index = SCENARIOS.indexOf(value);
  return (
    <div data-testid={testId} className="w-full max-w-[16rem]">
      <style>{STYLE}</style>
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={index}
        aria-label="Revenue scenario"
        aria-valuetext={`${words[index]} estimate`}
        data-testid={`${testId}-input`}
        onChange={(event) => onChange(SCENARIOS[Number(event.currentTarget.value)] ?? 'expected')}
        className="ab-scenario block motion-reduce:transition-none!"
      />
      <div aria-hidden="true" className="-mt-2 grid grid-cols-3 font-body text-[11px] leading-none">
        {words.map((word, place) => (
          <span key={word} className={`${place === 0 ? 'text-left' : place === 1 ? 'text-center' : 'text-right'} ${place === index ? 'font-bold text-white' : ''}`} style={place === index ? undefined : { color: WHITE.a65 }}>
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
