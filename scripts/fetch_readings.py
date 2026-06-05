#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中国日报英语点津 双语新闻抓取脚本
每天自动抓取最新一篇双语文章，自动翻译 + 提取词汇，追加到 readings.json 中
无需任何 API Key，使用免费翻译服务
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import sys
import io
import time
from datetime import datetime, date
from urllib.parse import quote

# 修复 Windows 终端中文输出
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 配置
BASE_URL = "https://language.chinadaily.com.cn"
NEWS_URL = f"{BASE_URL}/news_bilingual"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
READINGS_FILE = os.path.join(SCRIPT_DIR, "..", "data", "readings.json")
MAX_ARTICLES = 100

# AI 翻译配置（可选，设置后翻译质量更好）
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_API_BASE = os.environ.get("AI_API_BASE", "https://api.deepseek.com")
AI_MODEL = os.environ.get("AI_MODEL", "deepseek-chat")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 内置考研高频词汇表（约200个常见词，用于自动标注释义）
BUILT_IN_VOCAB = {
    "abandon": "放弃，遗弃", "ability": "能力，才能", "absorb": "吸收，吸引",
    "abstract": "抽象的，摘要", "abundant": "丰富的，充裕的", "accelerate": "加速",
    "accomplish": "完成，实现", "accumulate": "积累，积聚", "accurate": "精确的，准确的",
    "acknowledge": "承认，致谢", "acquire": "获得，学到", "adapt": "适应，改编",
    "adequate": "足够的，适当的", "adjacent": "邻近的，毗连的", "adjust": "调整，适应",
    "administer": "管理，执行", "advocate": "提倡，拥护", "aggressive": "侵略的，激进的",
    "allocate": "分配，拨出", "ambiguous": "模糊的，含糊的", "analyze": "分析",
    "anticipate": "预期，预料", "apparent": "明显的，表面的", "approach": "方法，接近",
    "appropriate": "适当的", "approximate": "近似的，大约", "arbitrary": "任意的，武断的",
    "assert": "断言，主张", "assess": "评估，评定", "assume": "假设，承担",
    "attribute": "归因于，属性", "authentic": "真实的，可靠的", "autonomous": "自主的，自治的",
    "available": "可用的，可得到的", "benefit": "利益，好处", "bias": "偏见，偏差",
    "boundary": "边界，界限", "capable": "有能力的", "circumstance": "情况，环境",
    "coincide": "同时发生，巧合", "collapse": "崩溃，倒塌", "compensate": "补偿，赔偿",
    "competent": "胜任的，能干的", "comprehensive": "全面的，综合的", "compulsory": "强制的，必修的",
    "conceive": "构想，设想", "concentrate": "集中，浓缩", "conclude": "得出结论，结束",
    "concrete": "具体的，混凝土", "conflict": "冲突，矛盾", "confront": "面对，遭遇",
    "conscious": "有意识的，自觉的", "consequence": "结果，后果", "conservation": "保存，保护",
    "considerable": "相当大的，重要的", "consistent": "一致的，始终如一的", "constitute": "构成，组成",
    "consult": "咨询，请教", "contemplate": "沉思，注视", "controversy": "争论，争议",
    "conventional": "传统的，惯例的", "convert": "转变，转化", "cooperate": "合作，协作",
    "correspond": "符合，通信", "crucial": "至关重要的", "curb": "控制，抑制",
    "decline": "下降，拒绝", "dedicate": "致力于，奉献", "deficiency": "缺乏，不足",
    "deliberate": "故意的，深思熟虑的", "demonstrate": "证明，演示", "derive": "源于，获得",
    "detect": "发现，察觉", "diminish": "减少，削弱", "discipline": "纪律，学科",
    "discrimination": "歧视，辨别", "displace": "取代，转移", "distinct": "明显的，独特的",
    "distribute": "分配，分布", "diverse": "多样的，不同的", "dominate": "支配，主导",
    "dramatic": "戏剧性的，巨大的", "durable": "耐用的，持久的", "elaborate": "详细的，精心的",
    "eliminate": "消除，淘汰", "embrace": "拥抱，接纳", "emerge": "出现，兴起",
    "emphasize": "强调，着重", "endure": "忍受，持续", "enhance": "增强，提高",
    "enormous": "巨大的", "ensure": "确保，保证", "enterprise": "企业，事业",
    "equivalent": "等价的，相当的", "essential": "基本的，必要的", "establish": "建立，确立",
    "evaluate": "评价，评估", "evidence": "证据，迹象", "evolve": "进化，发展",
    "excessive": "过度的，过分的", "exclude": "排除，排斥", "exert": "施加，发挥",
    "exploit": "开发，利用", "expose": "暴露，揭露", "extraordinary": "非凡的，特别的",
    "facilitate": "促进，使便利", "fatigue": "疲劳，疲惫", "feasible": "可行的",
    "flexibility": "灵活性", "fluctuate": "波动，起伏", "formulate": "制定，构想",
    "fundamental": "基本的，根本的", "generate": "产生，生成", "genuine": "真正的，真诚的",
    "guarantee": "保证，担保", "hazard": "危险，危害", "highlight": "强调，突出",
    "hypothesis": "假设，假说", "identical": "相同的，一样的", "identify": "识别，确认",
    "ideology": "意识形态", "ignorance": "无知，愚昧", "illustrate": "说明，阐明",
    "immerse": "沉浸，使置身于", "impact": "影响，冲击", "implication": "含义，影响",
    "impose": "强加，征收", "incentive": "激励，刺激", "incorporate": "包含，合并",
    "indicate": "表明，指出", "inevitable": "不可避免的", "infrastructure": "基础设施",
    "inherent": "固有的，内在的", "initiative": "主动性，倡议", "innovation": "创新",
    "integrate": "整合，融合", "intense": "强烈的，紧张的", "interpret": "解释，口译",
    "investigate": "调查，研究", "isolate": "隔离，孤立", "justify": "证明…正当",
    "launch": "发起，发射", "legislation": "立法，法律", "legitimate": "合法的，正当的",
    "liberal": "自由的，开明的", "manipulate": "操纵，控制", "mechanism": "机制，机理",
    "migrate": "迁移，移居", "moderate": "适度的，温和的", "motivate": "激励，激发",
    "negotiate": "谈判，协商", "nevertheless": "然而，不过", "nominal": "名义上的",
    "obligation": "义务，责任", "obstacle": "障碍，阻碍", "occupy": "占据，占用",
    "offspring": "后代，子孙", "optimistic": "乐观的", "overlap": "重叠，交叉",
    "overwhelm": "压倒，淹没", "participate": "参与，参加", "peculiar": "特殊的，独特的",
    "perceive": "感知，理解", "permanent": "永久的，固定的", "perspective": "视角，观点",
    "phenomenon": "现象", "pledge": "保证，誓言", "portable": "便携的",
    "potential": "潜在的，潜力", "practitioner": "从业者", "precede": "先于，在…之前",
    "predominant": "主要的，占主导的", "premise": "前提，假设", "prescribe": "规定，开处方",
    "prestige": "声望，威信", "prevalent": "流行的，普遍的", "preventive": "预防的",
    "principal": "主要的，校长", "priority": "优先，优先权", "privilege": "特权，优待",
    "proceed": "继续，进行", "productive": "多产的", "profound": "深刻的，深远的",
    "prohibit": "禁止", "prominent": "突出的，杰出的", "proportion": "比例，部分",
    "prospect": "前景，展望", "prosperity": "繁荣，兴旺", "protest": "抗议，反对",
    "provoke": "激起，挑衅", "pursue": "追求，追赶", "qualify": "有资格，限定",
    "recession": "衰退，不景气", "reckon": "认为，估算", "reconcile": "调和，和解",
    "reform": "改革", "regulate": "调节，管理", "reinforce": "加强，增援",
    "relevant": "相关的", "reliable": "可靠的", "reluctant": "不情愿的",
    "remarkable": "显著的，非凡的", "remedy": "补救，治疗", "render": "使成为，提供",
    "represent": "代表，表示", "reproduce": "繁殖，复制", "reputation": "名声，声誉",
    "resemble": "类似，像", "reside": "居住，存在", "resilience": "韧性，恢复力",
    "respective": "各自的", "restore": "恢复，修复", "restrict": "限制，约束",
    "retain": "保留，保持", "reveal": "揭示，显示", "revenue": "收入，税收",
    "reverse": "颠倒，反转", "revolution": "革命，变革", "rigid": "严格的，僵硬的",
    "safeguard": "保护，捍卫", "scarcely": "几乎不", "schedule": "时间表，安排",
    "scope": "范围，余地", "secure": "安全的，获得", "shift": "转变，转移",
    "significant": "重要的，显著的", "sophisticated": "复杂的，精密的", "specify": "指定，详述",
    "stagnant": "停滞的", "stimulate": "刺激，促进", "strategy": "策略，战略",
    "strengthen": "加强，巩固", "submit": "提交，服从", "substantial": "大量的，实质的",
    "sufficient": "足够的，充分的", "summarize": "总结，概括", "supplement": "补充，增刊",
    "suppress": "压制，抑制", "sustainable": "可持续的", "symptom": "症状，征兆",
    "tendency": "趋势，倾向", "terminal": "终点的，终端", "terminate": "终止，结束",
    "territory": "领土，领域", "thesis": "论文，论点", "tolerate": "容忍，忍受",
    "transform": "转变，改造", "transmission": "传播，传输", "tremendous": "巨大的，惊人的",
    "trigger": "触发，引起", "undermine": "削弱，破坏", "undertake": "承担，从事",
    "uniform": "统一的，制服", "universal": "普遍的，全球的", "urbanization": "城市化",
    "utilize": "利用", "valid": "有效的", "variable": "多变的，变量",
    "venture": "冒险，创业", "verify": "验证，证实", "version": "版本",
    "violate": "违反，侵犯", "virtue": "美德，优点", "visual": "视觉的",
    "vital": "至关重要的", "vivid": "生动的，鲜明的", "volume": "体积，音量",
    "voluntary": "自愿的", "vulnerable": "脆弱的，易受伤的", "welfare": "福利，幸福",
    "withdraw": "撤回，提取",
}


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


def split_content_translation(content):
    """将中英混合内容分离为英文内容和中文翻译
    
    处理两种情况：
    1. 纯中文段落 → 归入翻译
    2. 中英混合段落（英文+中文翻译在同一行）→ 提取英文部分和中文部分
    """
    if not content:
        return '', ''
    
    paragraphs = re.split(r'\n\n+', content)
    english_parts = []
    chinese_parts = []
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        if is_chinese_paragraph(para):
            # 纯中文段落归入翻译
            chinese_parts.append(para)
        else:
            # 中英混合段落，逐字符分离
            eng_segments = []
            chn_segments = []
            current = ''
            is_current_cn = None
            
            for ch in para:
                if ch in ' \n\r\t':
                    current += ch
                    continue
                ch_is_cn = ('\u4e00' <= ch <= '\u9fff' or '\u3400' <= ch <= '\u4dbf' or
                           '\u3000' <= ch <= '\u303f' or '\uff00' <= ch <= '\uffef')
                if is_current_cn is None:
                    is_current_cn = ch_is_cn
                    current += ch
                elif ch_is_cn == is_current_cn:
                    current += ch
                else:
                    if is_current_cn:
                        chn_segments.append(current.strip())
                    else:
                        eng_segments.append(current.strip())
                    current = ch
                    is_current_cn = ch_is_cn
            
            if current:
                if is_current_cn:
                    chn_segments.append(current.strip())
                else:
                    eng_segments.append(current.strip())
            
            if eng_segments:
                english_parts.append(' '.join(s for s in eng_segments if len(s) >= 3))
            if chn_segments:
                chinese_parts.append(' '.join(s for s in chn_segments if len(s) >= 2))
    
    return '\n\n'.join(english_parts), '\n\n'.join(chinese_parts)


def fetch_page(url, timeout=30):
    """获取网页内容"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.encoding = "utf-8"
        return resp.text
    except Exception as e:
        print(f"  [ERROR] 获取页面失败: {url} - {e}")
        return None


def extract_article_list(html):
    """从双语新闻列表页提取文章标题和链接"""
    soup = BeautifulSoup(html, "html.parser")
    articles = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href:
            continue
        if "language.chinadaily.com.cn" in href and ("/content_" in href or "/a/" in href):
            full_url = href if href.startswith("http") else f"https:{href}" if href.startswith("//") else f"{BASE_URL}{href}"
            title = a.get_text(strip=True)
            if title and len(title) > 5 and "首页" not in title:
                articles.append({"title": title, "url": full_url})

    if not articles:
        for container in soup.select(".main_list, .listBox, .busBox3, .tw3_01_2"):
            for a in container.find_all("a", href=True):
                title = a.get_text(strip=True)
                if title and len(title) > 5:
                    href = a["href"]
                    full_url = href if href.startswith("http") else f"https:{href}" if href.startswith("//") else f"{BASE_URL}{href}"
                    articles.append({"title": title, "url": full_url})

    seen = set()
    unique_articles = []
    for a in articles:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique_articles.append(a)

    print(f"  从列表页提取到 {len(unique_articles)} 篇文章")
    return unique_articles


def extract_article_content(html, url):
    """从文章详情页提取正文内容"""
    soup = BeautifulSoup(html, "html.parser")
    content_parts = []

    for selector in ["#Content", ".article-content", ".content", "#article-content", ".TRS_Editor", ".article", "article"]:
        container = soup.select_one(selector)
        if container:
            for p in container.find_all(["p", "div"], class_=lambda c: c is None or "para" in str(c).lower()):
                text = p.get_text(strip=True)
                if text and len(text) > 10:
                    content_parts.append(text)
            if content_parts:
                break

    if not content_parts:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if text and len(text) > 20 and not any(skip in text.lower() for skip in ["copyright", "©", "all rights", "recommended"]):
                content_parts.append(text)

    content = "\n\n".join(content_parts[:30])
    if not content:
        print(f"  [WARN] 未能提取到正文内容: {url}")
        return ""
    return content


def extract_vocabulary(html):
    """尝试从页面提取重点词汇"""
    soup = BeautifulSoup(html, "html.parser")
    vocab = []

    for selector in [".vocab", ".keywords", ".key-words", ".word-list"]:
        container = soup.select_one(selector)
        if container:
            items = container.find_all("li") or container.find_all("p")
            for item in items[:10]:
                text = item.get_text(strip=True)
                parts = re.split(r"[：:，,\s]+", text, maxsplit=1)
                if len(parts) == 2:
                    word, meaning = parts[0].strip(), parts[1].strip()
                    if len(word) > 1 and len(meaning) > 1:
                        vocab.append({"word": word, "meaning": meaning})

    return vocab


def free_translate(text, source="en", target="zh"):
    """使用免费翻译 API 翻译文本（无需 API Key）
    优先使用 MyMemory API，备用 LibreTranslate
    """
    if not text or len(text.strip()) < 10:
        return ""

    # MyMemory 免费翻译 API（每天 5000 字符免费额度，无需注册）
    try:
        url = "https://api.mymemory.translated.net/get"
        params = {
            "q": text[:500],  # MyMemory 每次最多 500 字符
            "langpair": f"{source}|{target}",
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("responseData") and data["responseData"].get("translatedText"):
            result = data["responseData"]["translatedText"]
            # MyMemory 有时会返回大写的提示，过滤掉
            if result.upper() != result or len(result) > 20:
                return result
    except Exception as e:
        print(f"  [WARN] MyMemory 翻译失败: {e}")

    return ""


def free_translate_long(text):
    """分段翻译长文本"""
    if not text:
        return ""

    paragraphs = text.split("\n\n")
    translated_parts = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            translated_parts.append("")
            continue

        # 对于短段落直接翻译
        if len(para) <= 500:
            t = free_translate(para)
            if t:
                translated_parts.append(t)
            else:
                translated_parts.append(para)  # 翻译失败保留原文
            time.sleep(0.3)  # 避免请求过快
        else:
            # 长段落按句子分割后翻译
            sentences = re.split(r'(?<=[.!?])\s+', para)
            chunk = ""
            translated_chunk = ""
            for sent in sentences:
                if len(chunk) + len(sent) > 450:
                    t = free_translate(chunk)
                    translated_chunk += (t or chunk) + " "
                    chunk = sent
                    time.sleep(0.3)
                else:
                    chunk += (" " if chunk else "") + sent
            if chunk:
                t = free_translate(chunk)
                translated_chunk += t or chunk
            translated_parts.append(translated_chunk.strip())

    result = "\n\n".join(translated_parts)
    return result


def ai_translate_and_vocab(title, content):
    """调用 AI API 翻译文章并提取重点词汇（需要 API Key）"""
    if not AI_API_KEY:
        return None, None

    prompt = f"""请对以下英文新闻文章完成两个任务：

1. 将全文翻译为流畅的中文（保持段落结构，专业术语准确）
2. 从文中提取5-8个重点英语词汇，给出中文释义

请严格按以下 JSON 格式输出，不要有任何其他内容：
{{
  "translation": "中文翻译内容（段落之间用\\n\\n分隔）",
  "vocab": [
    {{"word": "英文单词", "meaning": "中文释义"}},
    {{"word": "英文单词", "meaning": "中文释义"}}
  ]
}}

文章标题：{title}

文章正文：
{content}"""

    try:
        resp = requests.post(
            f"{AI_API_BASE}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {AI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 3000,
            },
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        text = result["choices"][0]["message"]["content"].strip()

        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        parsed = json.loads(text)
        translation = parsed.get("translation", "")
        vocab = parsed.get("vocab", [])

        if translation:
            print(f"  [OK] AI 翻译完成，{len(translation)} 字")
        if vocab:
            print(f"  [OK] AI 提取 {len(vocab)} 个词汇")

        return translation, vocab

    except Exception as e:
        print(f"  [WARN] AI 翻译失败: {e}，回退到免费翻译")
        return None, None


def auto_extract_vocab(content):
    """从文章中自动提取重点词汇（使用内置词汇表匹配）"""
    # 提取文章中所有英文单词
    words = re.findall(r'\b[a-zA-Z]+\b', content.lower())
    word_count = {}
    for w in words:
        if len(w) >= 4:  # 忽略太短的词
            word_count[w] = word_count.get(w, 0) + 1

    # 超高频常见词（不需要学习）——覆盖初中/高中基础词汇
    stop_words = {
        # 冠词/代词/介词/连词
        "the", "and", "that", "this", "with", "from", "they", "have", "been",
        "their", "which", "would", "about", "could", "other", "should", "these",
        "those", "there", "where", "when", "what", "some", "than", "into", "also",
        "more", "most", "such", "only", "just", "over", "like", "very", "even",
        "still", "much", "well", "back", "then", "being", "having", "does", "will",
        "said", "many", "before", "after", "made", "make", "take", "came", "went",
        "same", "another", "while",
        # 初中基础词汇
        "know", "think", "give", "come", "great", "both", "under", "never",
        "because", "morning", "enough", "singing", "travel", "speak", "learn",
        "study", "water", "house", "world", "night", "today", "begin", "start",
        "place", "point", "hand", "part", "find", "tell", "work", "call",
        "good", "year", "people", "first", "time", "long", "look", "last",
        "used", "help", "need", "home", "life", "day", "way", "man", "woman",
        "child", "book", "door", "room", "food", "city", "name", "head",
        "love", "run", "walk", "talk", "play", "read", "write", "open",
        "close", "stop", "turn", "move", "live", "show", "hear", "feel",
        "keep", "bring", "hold", "carry", "pick", "stand", "sit", "watch",
        "small", "large", "high", "young", "old", "new", "every", "each",
        "often", "again", "always", "never", "already", "together", "around",
        "between", "through", "during", "without", "along", "across",
        # 高中常见词汇
        "school", "family", "friend", "story", "music", "game", "money",
        "power", "country", "state", "group", "number", "problem", "fact",
        "side", "kind", "form", "end", "result", "change", "example",
        "piece", "area", "field", "body", "dog", "car", "tree", "song",
        "week", "month", "idea", "mind", "heart", "word", "face", "eye",
        "left", "right", "real", "true", "free", "full", "sure", "ready",
        "hard", "easy", "away", "down", "near", "far", "own", "using",
        "trying", "going", "getting", "making", "taking", "coming", "looking",
        "working", "playing", "running", "writing", "reading", "speaking",
        "nature", "natural", "research", "experience", "spending",
        "morning", "evening", "season", "weather", "summer", "winter",
        "spring", "animal", "bird", "fish", "plant", "flower", "river",
        "mountain", "earth", "island", "ocean", "forest", "garden",
        "building", "market", "hospital", "college", "office", "class",
        "student", "teacher", "doctor", "artist", "leader", "player",
        "demands", "demand",
    }

    # 从内置词汇表中匹配文章中出现的中高频词
    vocab = []
    vocab_need_lookup = []  # 不在内置词表中的词，稍后查词典API

    for word, count in sorted(word_count.items(), key=lambda x: -x[1]):
        if word in stop_words:
            continue
        if word in BUILT_IN_VOCAB:
            vocab.append({"word": word, "meaning": BUILT_IN_VOCAB[word]})
        elif len(word) >= 6:
            vocab_need_lookup.append(word)

        if len(vocab) >= 10:
            break

    # 对不在内置词表中的词，调用免费词典API查询中文释义
    if vocab_need_lookup:
        print(f"  查询词典API获取 {len(vocab_need_lookup)} 个词的释义...")
        for word in vocab_need_lookup:
            meaning = lookup_word_meaning(word)
            if meaning:
                vocab.append({"word": word, "meaning": meaning})
            if len(vocab) >= 10:
                break

    # 把有释义的排前面
    vocab_with_meaning = [v for v in vocab if not v["meaning"].startswith("（")]
    vocab_without = [v for v in vocab if v["meaning"].startswith("（")]
    vocab = vocab_with_meaning + vocab_without

    return vocab[:7]


def lookup_word_meaning(word):
    """调用免费词典API查询单词中文释义"""
    # 方法1: 使用 Youdao API (免费，无需key)
    try:
        url = f"https://dict.youdao.com/suggest?q={word}&doctype=json"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            entries = data.get("data", {}).get("entries", [])
            if entries:
                for entry in entries:
                    explain = entry.get("explain", "")
                    if explain and any('\u4e00' <= c <= '\u9fff' for c in explain):
                        # 截断过长释义，只取第一个释义
                        parts = re.split(r'[；;]', explain)
                        short = parts[0].strip()
                        # 去掉词性标注前缀如 "n.", "adj."
                        short = re.sub(r'^\[.*?\]', '', short).strip()
                        if len(short) > 25:
                            short = short[:25]
                        return short
    except Exception:
        pass

    # 方法2: 使用 Free Dictionary API (英文释义，转为简短中文)
    try:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                meanings = data[0].get("meanings", [])
                if meanings:
                    pos = meanings[0].get("partOfSpeech", "")
                    defs = meanings[0].get("definitions", [])
                    if defs:
                        short_def = defs[0].get("definition", "")
                        if short_def:
                            pos_cn = {"noun": "n.", "verb": "v.", "adjective": "adj.", "adverb": "adv.",
                                      "preposition": "prep.", "conjunction": "conj."}.get(pos, "")
                            return f"{pos_cn} {short_def[:50]}"
    except Exception:
        pass

    return "（请查阅词典）"


def load_existing_readings():
    """加载已有文章"""
    if os.path.exists(READINGS_FILE):
        with open(READINGS_FILE, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def save_readings(readings):
    """保存文章列表"""
    os.makedirs(os.path.dirname(READINGS_FILE), exist_ok=True)
    with open(READINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(readings, f, ensure_ascii=False, indent=2)
    print(f"  已保存 {len(readings)} 篇文章到 {READINGS_FILE}")


def main():
    print(f"=== 中国日报英语点津 文章抓取 ===")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if AI_API_KEY:
        print(f"  AI 翻译: 已启用 ({AI_MODEL})")
    else:
        print(f"  AI 翻译: 免费翻译模式（无需 API Key）")

    # 1. 获取双语新闻列表
    print(f"\n[1/5] 获取双语新闻列表...")
    html = fetch_page(NEWS_URL)
    if not html:
        print("  获取列表页失败，尝试首页...")
        html = fetch_page(BASE_URL)
        if not html:
            print("  [FATAL] 无法获取任何页面，退出")
            sys.exit(1)

    articles = extract_article_list(html)
    if not articles:
        print("  [FATAL] 未提取到任何文章链接，退出")
        sys.exit(1)

    # 2. 加载已有文章
    print(f"\n[2/5] 加载已有文章...")
    existing = load_existing_readings()
    existing_urls = {a.get("url", "") for a in existing if "chinadaily.com.cn" in a.get("url", "")}
    existing_titles = {a.get("title", "").strip().lower() for a in existing}
    print(f"  已有 {len(existing)} 篇文章")

    # 3. 找一篇新文章
    print(f"\n[3/5] 查找新文章...")
    new_article = None
    for article in articles:
        art_title = article["title"].strip().lower()
        if article["url"] not in existing_urls and art_title not in existing_titles:
            new_article = article
            break

    if not new_article:
        print("  所有列表文章已存在，没有新文章需要抓取")
        print(f"\n✅ 无新文章，跳过")
        return 0

    print(f"  发现新文章: {new_article['title'][:80]}...")
    print(f"  链接: {new_article['url']}")

    # 4. 抓取文章详情
    print(f"\n[4/5] 抓取文章详情...")
    detail_html = fetch_page(new_article["url"])
    if not detail_html:
        print("  [ERROR] 无法获取文章详情页")
        sys.exit(1)

    content = extract_article_content(detail_html, new_article["url"])
    page_vocab = extract_vocabulary(detail_html)

    if not content:
        content = f'文章内容请点击链接查看原文：{new_article["url"]}\n\n（提示：中国日报英语点津页面可能需要浏览器环境才能完整展示内容。）'

    # 5. 分离中英文内容（必须在翻译之前）
    print(f"\n[5/5] 分离中英文并翻译...")
    english_content, chinese_from_content = split_content_translation(content)

    # 6. 翻译和词汇提取（只翻译纯英文部分，避免重复）
    translation = None
    ai_vocab = None

    # 优先尝试 AI 翻译（如果配置了 API Key）
    if AI_API_KEY:
        translation, ai_vocab = ai_translate_and_vocab(new_article["title"], english_content)

    # AI 不可用时，使用免费翻译
    if not translation:
        print("  使用免费翻译服务...")
        translation = free_translate_long(english_content)
        if translation:
            print(f"  [OK] 免费翻译完成，{len(translation)} 字")
        else:
            print(f"  [WARN] 翻译失败，使用正文中的中文翻译")

    # 词汇提取优先级：AI > 页面 > 自动提取
    final_vocab = ai_vocab if ai_vocab else page_vocab
    if not final_vocab:
        final_vocab = auto_extract_vocab(english_content)
        print(f"  [OK] 自动提取 {len(final_vocab)} 个词汇")

    # 翻译优先级：AI翻译 > 免费翻译 > 正文中的中文段落（只保留一个）
    final_translation = translation or chinese_from_content or ""

    # 构建文章对象
    today_str = date.today().strftime("%Y-%m-%d")
    reading = {
        "date": today_str,
        "title": new_article["title"].strip(),
        "source": "China Daily 英语点津",
        "url": new_article["url"],
        "content": english_content if english_content else content,
        "vocab": final_vocab,
    }
    if final_translation:
        reading["translation"] = final_translation

    # 更新文章列表（新文章插在最前面）
    existing.insert(0, reading)

    if len(existing) > MAX_ARTICLES:
        existing = existing[:MAX_ARTICLES]

    save_readings(existing)
    print(f"\n✅ 抓取完成！新增文章: {reading['title']}")
    print(f"   文章总数: {len(existing)}")
    print(f"   翻译状态: {'已翻译' if translation else '未翻译'}")
    print(f"   词汇数量: {len(final_vocab)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
