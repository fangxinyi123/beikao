# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
import json
import os
import re
from datetime import date

BASE_URL = "https://language.chinadaily.com.cn"
NEWS_URL = BASE_URL + "/news_bilingual"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

# ==================== 中英文段落判断 ====================

def is_chinese_paragraph(text):
    """判断一段文本是否主要是中文（中文字符占比 > 50%）"""
    if not text or not text.strip():
        return False
    trimmed = text.strip()
    chinese_count = 0
    total_count = 0
    for ch in trimmed:
        if ch in ' \n\r\t':
            continue
        total_count += 1
        if ('\u4e00' <= ch <= '\u9fff' or '\u3400' <= ch <= '\u4dbf' or
            '\u3000' <= ch <= '\u303f' or '\uff00' <= ch <= '\uffef'):
            chinese_count += 1
    return total_count > 0 and (float(chinese_count) / total_count) > 0.5


def split_content_translation(content_parts):
    """将段落列表拆分为英文内容和中文翻译"""
    english_parts = []
    chinese_parts = []
    for p in content_parts:
        if is_chinese_paragraph(p):
            chinese_parts.append(p)
        else:
            english_parts.append(p)
    return '\n\n'.join(english_parts), '\n\n'.join(chinese_parts)


# Step 1: Fetch article list
print("Fetching article list...")
r = requests.get(NEWS_URL, headers=HEADERS, timeout=30)
r.encoding = 'utf-8'
soup = BeautifulSoup(r.text, 'html.parser')

articles = []
for a in soup.find_all('a', href=True):
    href = a.get('href', '')
    title = a.get_text(strip=True)
    if ('/a/' in href or '/content_' in href) and len(title) > 10:
        full_url = href if href.startswith('http') else (BASE_URL + href if href.startswith('/') else BASE_URL + '/' + href)
        articles.append({'title': title, 'url': full_url})

# Deduplicate
seen = set()
unique = []
for a in articles:
    if a['url'] not in seen:
        seen.add(a['url'])
        unique.append(a)

print("Found %d articles" % len(unique))
for a in unique[:3]:
    print("  - %s" % a['title'][:60])

# Step 2: Load existing readings
readings_file = os.path.join(os.path.dirname(__file__), 'repo_data', 'readings.json')
existing = []
existing_urls = set()
if os.path.exists(readings_file):
    with open(readings_file, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    existing_urls = {a.get('url', '') for a in existing}
    print("Existing readings: %d" % len(existing))

# Step 3: Find new article
new_article = None
for a in unique:
    if a['url'] not in existing_urls:
        new_article = a
        break

if not new_article:
    print("No new article found. All articles already exist.")
else:
    print("\nNew article: %s" % new_article['title'])
    print("URL: %s" % new_article['url'])
    
    # Step 4: Fetch article content
    print("\nFetching article content...")
    r2 = requests.get(new_article['url'], headers=HEADERS, timeout=30)
    r2.encoding = 'utf-8'
    soup2 = BeautifulSoup(r2.text, 'html.parser')
    
    content_parts = []
    for selector in ['#Content', '.article-content', '.content', '#article-content']:
        container = soup2.select_one(selector)
        if container:
            for p in container.find_all(['p', 'div']):
                text = p.get_text(strip=True)
                if text and len(text) > 10:
                    content_parts.append(text)
            if content_parts:
                break
    
    if not content_parts:
        for p in soup2.find_all('p'):
            text = p.get_text(strip=True)
            if text and len(text) > 20:
                content_parts.append(text)
    
    content_raw = '\n\n'.join(content_parts[:40])
    print("Raw content length: %d chars" % len(content_raw))
    
    # Step 4.5: 分离中英文内容
    english_content, chinese_translation = split_content_translation(content_parts[:40])
    print("English content length: %d chars" % len(english_content))
    print("Chinese translation length: %d chars" % len(chinese_translation))
    
    # Step 5: Build reading entry
    today_str = date.today().strftime('%Y-%m-%d')
    reading = {
        "date": today_str,
        "title": new_article['title'],
        "source": "China Daily ying yu dian jin",
        "url": new_article['url'],
        "content": english_content,
        "vocab": [],
        "translation": chinese_translation
    }
    
    existing.insert(0, reading)
    if len(existing) > 100:
        existing = existing[:100]
    
    # Save
    os.makedirs(os.path.dirname(readings_file), exist_ok=True)
    with open(readings_file, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    
    print("\nSaved! Total readings: %d" % len(existing))
    print("New reading date: %s" % today_str)

print("\nDone!")
