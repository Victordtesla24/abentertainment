#!/usr/bin/env python3
"""
AB Entertainment Legacy Site Scraper
Extracts all content, images, metadata from https://www.abentertainment.com.au
Outputs structured data as a TypeScript constant file for Next.js seeding.
"""

import json
import os
import re
import sys
import time
import hashlib
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

TARGET_URL = "https://www.abentertainment.com.au"
OUTPUT_DIR = Path(__file__).parent.parent / "scraped-data"
IMAGES_DIR = OUTPUT_DIR / "images"
TS_OUTPUT = Path(__file__).parent.parent / "src" / "lib" / "legacy-site-data.ts"

PAGES_TO_SCRAPE = [
    "/",
    "/about",
    "/events",
    "/contact",
    "/gallery",
    "/sponsors",
    "/blog",
    "/services",
    "/team",
    "/testimonials",
]

DOWNLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}


def sanitize_filename(url: str) -> str:
    parsed = urlparse(url)
    name = parsed.path.strip("/").replace("/", "_")
    if not name:
        name = "index"
    ext = Path(parsed.path).suffix.lower()
    if ext not in DOWNLOAD_EXTENSIONS:
        ext = ".jpg"
    h = hashlib.md5(url.encode()).hexdigest()[:8]
    clean = re.sub(r"[^a-zA-Z0-9_\-]", "_", name)
    return f"{clean}_{h}{ext}"


def extract_text_nodes(soup: BeautifulSoup) -> list[dict]:
    """Extract all meaningful text blocks from the page."""
    results: list[dict] = []
    seen: set[str] = set()

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "span", "blockquote", "figcaption"]):
        if not isinstance(tag, Tag):
            continue
        text = tag.get_text(strip=True)
        if not text or len(text) < 3 or text in seen:
            continue
        seen.add(text)

        parent_section = None
        for ancestor in tag.parents:
            if isinstance(ancestor, Tag) and ancestor.name == "section":
                section_id = ancestor.get("id", "")
                section_class = " ".join(ancestor.get("class", []))
                parent_section = section_id or section_class[:60] or None
                break

        results.append({
            "tag": tag.name,
            "text": text,
            "section": parent_section,
        })

    return results


def extract_images(soup: BeautifulSoup, base_url: str) -> list[dict]:
    """Extract all image sources with alt text and dimensions."""
    images: list[dict] = []
    seen_srcs: set[str] = set()

    for img in soup.find_all("img"):
        if not isinstance(img, Tag):
            continue
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if not src:
            continue

        full_src = urljoin(base_url, str(src))
        if full_src in seen_srcs:
            continue
        seen_srcs.add(full_src)

        srcset = img.get("srcset", "")
        alt = img.get("alt", "")
        width = img.get("width", "")
        height = img.get("height", "")
        loading = img.get("loading", "")

        images.append({
            "src": full_src,
            "alt": str(alt),
            "width": str(width),
            "height": str(height),
            "loading": str(loading),
            "srcset": str(srcset)[:200],
            "localFilename": sanitize_filename(full_src),
        })

    # Also extract CSS background images
    for el in soup.find_all(style=True):
        if not isinstance(el, Tag):
            continue
        style = str(el.get("style", ""))
        bg_urls = re.findall(r'url\(["\']?(.*?)["\']?\)', style)
        for bg_url in bg_urls:
            full_url = urljoin(base_url, bg_url)
            if full_url not in seen_srcs and any(full_url.lower().endswith(ext) for ext in DOWNLOAD_EXTENSIONS):
                seen_srcs.add(full_url)
                images.append({
                    "src": full_url,
                    "alt": "background-image",
                    "width": "",
                    "height": "",
                    "loading": "",
                    "srcset": "",
                    "localFilename": sanitize_filename(full_url),
                })

    return images


def extract_metadata(soup: BeautifulSoup) -> dict:
    """Extract page metadata."""
    meta: dict = {}

    title_tag = soup.find("title")
    meta["title"] = title_tag.get_text(strip=True) if title_tag else ""

    for tag in soup.find_all("meta"):
        if not isinstance(tag, Tag):
            continue
        name = tag.get("name") or tag.get("property") or ""
        content = tag.get("content", "")
        if name and content:
            meta[str(name)] = str(content)

    # Extract structured data
    for script in soup.find_all("script", type="application/ld+json"):
        if isinstance(script, Tag):
            try:
                ld_json = json.loads(script.string or "")
                meta.setdefault("structuredData", []).append(ld_json)
            except (json.JSONDecodeError, TypeError):
                pass

    return meta


def extract_events(soup: BeautifulSoup) -> list[dict]:
    """Extract event-specific data if present."""
    events: list[dict] = []

    for card in soup.find_all(class_=re.compile(r"event|card|listing", re.I)):
        if not isinstance(card, Tag):
            continue
        heading = card.find(["h2", "h3", "h4"])
        title = heading.get_text(strip=True) if heading else ""
        if not title:
            continue

        desc_el = card.find("p")
        description = desc_el.get_text(strip=True) if desc_el else ""

        date_el = card.find(class_=re.compile(r"date|time", re.I))
        date_text = date_el.get_text(strip=True) if date_el else ""

        venue_el = card.find(class_=re.compile(r"venue|location", re.I))
        venue_text = venue_el.get_text(strip=True) if venue_el else ""

        price_el = card.find(class_=re.compile(r"price|cost|ticket", re.I))
        price_text = price_el.get_text(strip=True) if price_el else ""

        img = card.find("img")
        image_src = ""
        if img and isinstance(img, Tag):
            image_src = str(img.get("src") or img.get("data-src") or "")

        events.append({
            "title": title,
            "description": description,
            "date": date_text,
            "venue": venue_text,
            "price": price_text,
            "image": image_src,
        })

    return events


def extract_sponsors(soup: BeautifulSoup, base_url: str) -> list[dict]:
    """Extract sponsor/partner information."""
    sponsors: list[dict] = []

    for container in soup.find_all(class_=re.compile(r"sponsor|partner|client|brand", re.I)):
        if not isinstance(container, Tag):
            continue
        for img in container.find_all("img"):
            if not isinstance(img, Tag):
                continue
            alt = str(img.get("alt", ""))
            src = str(img.get("src") or img.get("data-src") or "")
            if alt or src:
                sponsors.append({
                    "name": alt or "Unknown Sponsor",
                    "logo": urljoin(base_url, src) if src else "",
                    "localFilename": sanitize_filename(urljoin(base_url, src)) if src else "",
                })

    # Also look for sponsor text mentions
    for heading in soup.find_all(["h2", "h3", "h4"]):
        if not isinstance(heading, Tag):
            continue
        text = heading.get_text(strip=True).lower()
        if "sponsor" in text or "partner" in text:
            parent = heading.parent
            if isinstance(parent, Tag):
                for link in parent.find_all("a"):
                    if isinstance(link, Tag):
                        href = str(link.get("href", ""))
                        name = link.get_text(strip=True)
                        if name and href:
                            sponsors.append({
                                "name": name,
                                "logo": "",
                                "url": href,
                                "localFilename": "",
                            })

    return sponsors


def download_images(images: list[dict], session) -> int:
    """Download images to local directory."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    downloaded = 0

    for img in images:
        src = img.get("src", "")
        if not src:
            continue

        local_path = IMAGES_DIR / img["localFilename"]
        if local_path.exists():
            downloaded += 1
            continue

        try:
            resp = session.get(src, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 100:
                local_path.write_bytes(resp.content)
                downloaded += 1
                print(f"  Downloaded: {img['localFilename']} ({len(resp.content)} bytes)")
        except Exception as e:
            print(f"  Failed: {src} - {e}")

    return downloaded


def scrape_page(page, url: str) -> dict:
    """Scrape a single page with Playwright."""
    print(f"\nScraping: {url}")

    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)
    except PlaywrightTimeout:
        print(f"  Timeout loading {url}, trying with domcontentloaded...")
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1000)
        except Exception as e:
            print(f"  Failed to load {url}: {e}")
            return {"url": url, "error": str(e)}

    # Scroll to load lazy content
    try:
        page.evaluate("""
            async () => {
                const delay = ms => new Promise(r => setTimeout(r, ms));
                for (let i = 0; i < document.body.scrollHeight; i += 400) {
                    window.scrollTo(0, i);
                    await delay(200);
                }
                window.scrollTo(0, 0);
            }
        """)
        page.wait_for_timeout(1000)
    except Exception:
        pass

    html = page.content()
    soup = BeautifulSoup(html, "html.parser")

    # Remove script and style tags for text extraction
    for tag in soup.find_all(["script", "style", "noscript"]):
        tag.decompose()

    text_nodes = extract_text_nodes(soup)
    images = extract_images(soup, url)
    metadata = extract_metadata(soup)
    events = extract_events(soup)
    sponsors = extract_sponsors(soup, url)

    page_path = urlparse(url).path or "/"
    page_name = page_path.strip("/") or "home"

    result = {
        "url": url,
        "path": page_path,
        "pageName": page_name,
        "metadata": metadata,
        "textNodes": text_nodes,
        "images": images,
        "events": events,
        "sponsors": sponsors,
        "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    print(f"  Text nodes: {len(text_nodes)}, Images: {len(images)}, Events: {len(events)}, Sponsors: {len(sponsors)}")
    return result


def generate_typescript(scraped_data: list[dict]) -> str:
    """Generate strongly-typed TypeScript constant file from scraped data."""
    lines = [
        "/**",
        " * Legacy Site Data - Auto-extracted from https://www.abentertainment.com.au",
        f" * Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
        " * DO NOT EDIT MANUALLY - Regenerate with scripts/scrape_legacy_site.py",
        " */",
        "",
        "export interface LegacyTextNode {",
        "  tag: string;",
        "  text: string;",
        "  section: string | null;",
        "}",
        "",
        "export interface LegacyImage {",
        "  src: string;",
        "  alt: string;",
        "  width: string;",
        "  height: string;",
        "  localFilename: string;",
        "}",
        "",
        "export interface LegacyEvent {",
        "  title: string;",
        "  description: string;",
        "  date: string;",
        "  venue: string;",
        "  price: string;",
        "  image: string;",
        "}",
        "",
        "export interface LegacySponsor {",
        "  name: string;",
        "  logo: string;",
        "  localFilename: string;",
        "  url?: string;",
        "}",
        "",
        "export interface LegacyPageData {",
        "  url: string;",
        "  path: string;",
        "  pageName: string;",
        "  metadata: Record<string, string | object[]>;",
        "  textNodes: LegacyTextNode[];",
        "  images: LegacyImage[];",
        "  events: LegacyEvent[];",
        "  sponsors: LegacySponsor[];",
        "  scrapedAt: string;",
        "}",
        "",
    ]

    # Collect all unique text by page for content seeding
    all_events: list[dict] = []
    all_sponsors: list[dict] = []
    all_images: list[dict] = []
    page_content: dict[str, dict] = {}

    for page_data in scraped_data:
        if "error" in page_data:
            continue

        name = page_data.get("pageName", "unknown")
        metadata = page_data.get("metadata", {})
        text_nodes = page_data.get("textNodes", [])
        images = page_data.get("images", [])
        events = page_data.get("events", [])
        sponsors = page_data.get("sponsors", [])

        # Collect headings and paragraphs
        headings = [n["text"] for n in text_nodes if n["tag"] in ("h1", "h2", "h3")]
        paragraphs = [n["text"] for n in text_nodes if n["tag"] == "p" and len(n["text"]) > 20]

        page_content[name] = {
            "title": metadata.get("title", ""),
            "description": metadata.get("description", ""),
            "ogTitle": metadata.get("og:title", ""),
            "ogDescription": metadata.get("og:description", ""),
            "ogImage": metadata.get("og:image", ""),
            "headings": headings[:10],
            "paragraphs": paragraphs[:15],
            "imageCount": len(images),
        }

        all_events.extend(events)
        all_sponsors.extend(sponsors)
        all_images.extend(images)

    # Deduplicate sponsors
    seen_sponsors: set[str] = set()
    unique_sponsors: list[dict] = []
    for s in all_sponsors:
        key = s.get("name", "").lower()
        if key and key not in seen_sponsors:
            seen_sponsors.add(key)
            unique_sponsors.append(s)

    lines.append("export const LEGACY_PAGE_CONTENT: Record<string, {")
    lines.append("  title: string;")
    lines.append("  description: string;")
    lines.append("  ogTitle: string;")
    lines.append("  ogDescription: string;")
    lines.append("  ogImage: string;")
    lines.append("  headings: string[];")
    lines.append("  paragraphs: string[];")
    lines.append("  imageCount: number;")
    lines.append("}> = {")

    for name, content in page_content.items():
        safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
        lines.append(f"  '{safe_name}': {{")
        lines.append(f"    title: {json.dumps(content['title'])},")
        lines.append(f"    description: {json.dumps(content['description'])},")
        lines.append(f"    ogTitle: {json.dumps(content['ogTitle'])},")
        lines.append(f"    ogDescription: {json.dumps(content['ogDescription'])},")
        lines.append(f"    ogImage: {json.dumps(content['ogImage'])},")

        lines.append(f"    headings: [")
        for h in content["headings"]:
            lines.append(f"      {json.dumps(h)},")
        lines.append(f"    ],")

        lines.append(f"    paragraphs: [")
        for p in content["paragraphs"]:
            lines.append(f"      {json.dumps(p)},")
        lines.append(f"    ],")

        lines.append(f"    imageCount: {content['imageCount']},")
        lines.append(f"  }},")

    lines.append("} as const;")
    lines.append("")

    # Legacy events
    lines.append("export const LEGACY_EVENTS: LegacyEvent[] = [")
    for evt in all_events:
        lines.append("  {")
        lines.append(f"    title: {json.dumps(evt.get('title', ''))},")
        lines.append(f"    description: {json.dumps(evt.get('description', ''))},")
        lines.append(f"    date: {json.dumps(evt.get('date', ''))},")
        lines.append(f"    venue: {json.dumps(evt.get('venue', ''))},")
        lines.append(f"    price: {json.dumps(evt.get('price', ''))},")
        lines.append(f"    image: {json.dumps(evt.get('image', ''))},")
        lines.append("  },")
    lines.append("];")
    lines.append("")

    # Legacy sponsors
    lines.append("export const LEGACY_SPONSORS: LegacySponsor[] = [")
    for sp in unique_sponsors:
        lines.append("  {")
        lines.append(f"    name: {json.dumps(sp.get('name', ''))},")
        lines.append(f"    logo: {json.dumps(sp.get('logo', ''))},")
        lines.append(f"    localFilename: {json.dumps(sp.get('localFilename', ''))},")
        if sp.get("url"):
            lines.append(f"    url: {json.dumps(sp['url'])},")
        lines.append("  },")
    lines.append("];")
    lines.append("")

    # Legacy images summary
    lines.append(f"export const LEGACY_IMAGE_COUNT = {len(all_images)};")
    lines.append("")

    # High-res hero images for potential reuse
    hero_images = [img for img in all_images if img.get("alt") and ("hero" in img.get("alt", "").lower() or "banner" in img.get("alt", "").lower() or "header" in img.get("alt", "").lower())]
    lines.append("export const LEGACY_HERO_IMAGES: LegacyImage[] = [")
    for img in hero_images[:5]:
        lines.append("  {")
        lines.append(f"    src: {json.dumps(img.get('src', ''))},")
        lines.append(f"    alt: {json.dumps(img.get('alt', ''))},")
        lines.append(f"    width: {json.dumps(img.get('width', ''))},")
        lines.append(f"    height: {json.dumps(img.get('height', ''))},")
        lines.append(f"    localFilename: {json.dumps(img.get('localFilename', ''))},")
        lines.append("  },")
    lines.append("];")
    lines.append("")

    return "\n".join(lines)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    import requests
    session = requests.Session()
    session.headers.update({
        "User-Agent": "ABEntertainment-Migration-Bot/1.0 (authorized internal migration)"
    })

    scraped_data: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="ABEntertainment-Migration-Bot/1.0 (authorized internal migration)",
        )
        page = context.new_page()

        for path in PAGES_TO_SCRAPE:
            url = f"{TARGET_URL}{path}"
            result = scrape_page(page, url)
            scraped_data.append(result)

            # Small delay to be respectful
            time.sleep(1)

        browser.close()

    # Download all images
    all_images: list[dict] = []
    for page_data in scraped_data:
        if "error" not in page_data:
            all_images.extend(page_data.get("images", []))

    print(f"\nDownloading {len(all_images)} images...")
    downloaded = download_images(all_images, session)
    print(f"Downloaded {downloaded}/{len(all_images)} images")

    # Save raw JSON
    json_path = OUTPUT_DIR / "legacy-site-data.json"
    with open(json_path, "w") as f:
        json.dump(scraped_data, f, indent=2, ensure_ascii=False)
    print(f"\nRaw JSON saved: {json_path}")

    # Generate TypeScript
    ts_content = generate_typescript(scraped_data)
    TS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(TS_OUTPUT, "w") as f:
        f.write(ts_content)
    print(f"TypeScript saved: {TS_OUTPUT}")

    # Summary
    total_text = sum(len(p.get("textNodes", [])) for p in scraped_data if "error" not in p)
    total_images = sum(len(p.get("images", [])) for p in scraped_data if "error" not in p)
    total_events = sum(len(p.get("events", [])) for p in scraped_data if "error" not in p)
    total_sponsors = sum(len(p.get("sponsors", [])) for p in scraped_data if "error" not in p)

    print(f"\n{'='*60}")
    print(f"SCRAPE SUMMARY")
    print(f"{'='*60}")
    print(f"Pages scraped:  {len([p for p in scraped_data if 'error' not in p])}/{len(PAGES_TO_SCRAPE)}")
    print(f"Text nodes:     {total_text}")
    print(f"Images found:   {total_images}")
    print(f"Images saved:   {downloaded}")
    print(f"Events found:   {total_events}")
    print(f"Sponsors found: {total_sponsors}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
