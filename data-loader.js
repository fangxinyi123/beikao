// ==================== 数据加载器 ====================
// 题库、名言、外刊等基础数据

const SharedData = {
  MOTTOS: [],
  HEADER_MOTTOS: [],
  DAILY_QUOTES: [],
  DAILY_READINGS: [],
  QUIZ_BANK: {},

  // 加载数据（先设默认数据让页面立刻可用，再异步 fetch 更新）
  async load() {
    // 1. 立即用默认数据填充，确保页面不空白
    this.setDefaultMottos();
    this.setDefaultQuotes();
    this.setDefaultQuiz();

    // 2. 优先从 localStorage 缓存恢复外刊（毫秒级）
    // 缓存版本控制：版本不匹配时清除旧缓存，强制从服务器刷新
    const CACHE_VERSION = 'v3'; // 更新此版本号可强制刷新所有用户的缓存
    try {
      const cachedVersion = localStorage.getItem('study_readings_cache_version');
      if (cachedVersion === CACHE_VERSION) {
        const cached = JSON.parse(localStorage.getItem('study_cached_readings') || '[]');
        if (cached.length > 0) this.DAILY_READINGS = cached;
      } else {
        localStorage.removeItem('study_cached_readings');
        localStorage.setItem('study_readings_cache_version', CACHE_VERSION);
      }
    } catch(e) {}

    // 3. 异步 fetch 远端数据（不阻塞页面渲染）
    try {
      const [quizRes, mottoRes, readingRes] = await Promise.allSettled([
        fetch('data/quiz-bank.json'),
        fetch('data/mottos.json'),
        fetch('data/readings.json?v=' + Date.now())
      ]);

      if (quizRes.status === 'fulfilled' && quizRes.value.ok) {
        this.QUIZ_BANK = await quizRes.value.json();
      }
      if (mottoRes.status === 'fulfilled' && mottoRes.value.ok) {
        const mottoData = await mottoRes.value.json();
        this.MOTTOS = mottoData.mottos || [];
        this.HEADER_MOTTOS = mottoData.headerMottos || [];
        this.DAILY_QUOTES = mottoData.dailyQuotes || [];
      }
      if (readingRes.status === 'fulfilled' && readingRes.value.ok) {
        this.DAILY_READINGS = await readingRes.value.json();
        // 成功加载后缓存到 localStorage
        try { localStorage.setItem('study_cached_readings', JSON.stringify(this.DAILY_READINGS)); } catch(e) {}
      }
    } catch (e) {
      console.log('数据文件加载失败，使用内置数据:', e.message);
    }

    // 4. 合并本地贡献的数据
    this.mergeLocalContributions();

    // 5. 外刊兜底：fetch 和缓存都没有时，用精简默认
    if (this.DAILY_READINGS.length === 0) this.setDefaultReadings();
  },

  // 合并本地贡献数据
  mergeLocalContributions() {
    try {
      const contributedQuiz = JSON.parse(localStorage.getItem('study_contributed_quiz') || '{}');
      const contributedReadings = JSON.parse(localStorage.getItem('study_contributed_readings') || '[]');
      const contributedMottos = JSON.parse(localStorage.getItem('study_contributed_mottos') || '[]');
      const contributedQuotes = JSON.parse(localStorage.getItem('study_contributed_quotes') || '[]');

      // 合并题库
      Object.entries(contributedQuiz).forEach(([key, subj]) => {
        if (!this.QUIZ_BANK[key]) {
          this.QUIZ_BANK[key] = { name: subj.name, icon: subj.icon || '📝', questions: [] };
        }
        // 避免重复添加
        const existingQs = new Set(this.QUIZ_BANK[key].questions.map(q => q.q));
        (subj.questions || []).forEach(q => {
          if (!existingQs.has(q.q)) {
            this.QUIZ_BANK[key].questions.push(q);
          }
        });
      });

      // 合并外刊
      contributedReadings.forEach(r => {
        if (!this.DAILY_READINGS.some(existing => existing.title === r.title && existing.date === r.date)) {
          this.DAILY_READINGS.push(r);
        }
      });

      // 合并名言
      this.MOTTOS = [...this.MOTTOS, ...contributedMottos];
      this.DAILY_QUOTES = [...this.DAILY_QUOTES, ...contributedQuotes];

    } catch (e) {
      console.log('合并本地贡献失败:', e.message);
    }
  },

  // 默认激励语
  setDefaultMottos() {
    this.MOTTOS = [
      { text: '每一个不曾起舞的日子，都是对生命的辜负。', author: '尼采' },
      { text: '自律给我自由。', author: 'Keep' },
      { text: '今天不想跑，所以才去跑。', author: '村上春树' },
      { text: '种一棵树最好的时间是十年前，其次是现在。', author: '非洲谚语' },
      { text: '不积跬步，无以至千里。', author: '荀子' },
      { text: '博观而约取，厚积而薄发。', author: '苏轼' },
      { text: '锲而舍之，朽木不折；锲而不舍，金石可镂。', author: '荀子' },
      { text: '长风破浪会有时，直挂云帆济沧海。', author: '李白' },
    ];
    this.HEADER_MOTTOS = ['今天也要加油呀 💪', '坚持就是胜利 ✨', '每一天都是新的开始 🌅', '你一定可以的！🎯', '冲冲冲！🔥', '不负青春不负己 📚'];
  },

  // 默认每日一句
  setDefaultQuotes() {
    this.DAILY_QUOTES = [
      { text: '学而不思则罔，思而不学则殆。', source: '《论语》' },
      { text: '宝剑锋从磨砺出，梅花香自苦寒来。', source: '《警世贤文》' },
      { text: '路漫漫其修远兮，吾将上下而求索。', source: '屈原' },
      { text: '天行健，君子以自强不息。', source: '《周易》' },
      { text: '千里之行，始于足下。', source: '《道德经》' },
      { text: '业精于勤，荒于嬉；行成于思，毁于随。', source: '韩愈' },
      { text: '吾生也有涯，而知也无涯。', source: '庄子' },
      { text: '纸上得来终觉浅，绝知此事要躬行。', source: '陆游' },
    ];
  },

  // 默认题库
  setDefaultQuiz() {
    this.QUIZ_BANK = {
      politics: {
        name: '政治',
        icon: '🏛',
        questions: [
          { q: '马克思主义哲学认为，世界的统一性在于它的', opts: ['客观实在性', '运动性', '可知性', '多样性'], ans: 0 },
          { q: '唯物辩证法的实质和核心是', opts: ['对立统一规律', '质量互变规律', '否定之否定规律', '联系和发展的观点'], ans: 0 },
          { q: '实践是检验真理的唯一标准，这是因为', opts: ['实践具有直接现实性', '实践具有客观性', '实践具有社会历史性', '实践是主观见之于客观的活动'], ans: 0 },
          { q: '社会存在决定社会意识，社会意识是社会存在的反映。这是', opts: ['历史唯物主义观点', '历史唯心主义观点', '形而上学观点', '二元论观点'], ans: 0 },
          { q: '商品的价值量由生产商品的（ ）决定。', opts: ['社会必要劳动时间', '个别劳动时间', '使用价值', '交换价值'], ans: 0 },
        ]
      },
      english: {
        name: '英语',
        icon: '📖',
        questions: [
          { q: 'The company has ___ a new policy to improve employee satisfaction.', opts: ['implemented', 'implied', 'implicated', 'imposed'], ans: 0 },
          { q: 'She is ___ to win the competition after months of training.', opts: ['bound', 'about', 'likely', 'possible'], ans: 0 },
          { q: 'It is essential that every student ___ the assignment on time.', opts: ['submit', 'submits', 'submitted', 'submitting'], ans: 0 },
          { q: 'The professor suggested that we ___ more research before writing the paper.', opts: ['do', 'did', 'doing', 'done'], ans: 0 },
          { q: 'Not until the meeting was over ___ that he had made a mistake.', opts: ['did he realize', 'he realized', 'he did realize', 'realized he'], ans: 0 },
        ]
      },
      math3: {
        name: '数学三',
        icon: '📐',
        questions: [
          { q: '极限 lim(x→0) sin(x)/x = ?', opts: ['1', '0', '∞', '不存在'], ans: 0 },
          { q: '函数 f(x)=x² 在 x=1 处的导数是', opts: ['2', '1', '0', '3'], ans: 0 },
          { q: '∫₀¹ x dx = ?', opts: ['1/2', '1', '2', '0'], ans: 0 },
          { q: '矩阵 A 可逆的充要条件是', opts: ['|A|≠0', 'A 是对称矩阵', 'A 是正交矩阵', 'A 的秩为0'], ans: 0 },
          { q: '随机变量 X~N(0,1)，则 P(|X|<1.96) 约等于', opts: ['0.95', '0.99', '0.90', '0.68'], ans: 0 },
        ]
      }
    };
  },

  // 默认外刊数据（内置兜底，防止 fetch 失败时外刊为空）
  setDefaultReadings() {
    this.DAILY_READINGS = [
      {
        "date": "2026-06-04",
        "title": "Study: Immersing Yourself in Nature Can Profoundly Affect How You Experience Time",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "A new study published in the Journal of Environmental Psychology reveals that spending time in natural environments can significantly alter our perception of time. Researchers found that participants who took a 30-minute walk in a park reported feeling that time passed more slowly compared to those who walked in urban settings.\n\nThe study suggests that nature helps shift our attention from immediate concerns to future needs and long-term goals. \"When we're surrounded by trees, water, and wildlife, our minds naturally slow down,\" said Dr. Sarah Mitchell, the lead researcher. \"This could explain why people often feel more relaxed and clear-headed after spending time outdoors.\"\n\nThe findings have important implications for urban planning and mental health treatment. With increasing urbanization and screen time, providing accessible green spaces may be crucial for public well-being. Previous research has already linked nature exposure to reduced stress, improved mood, and better cognitive function.\n\n\"The next time you feel like time is slipping away, try taking a walk in the park,\" Mitchell advised. \"It might just give you the mental reset you need.\"",
        "translation": "发表在《环境心理学杂志》上的一项新研究表明，在自然环境中度过的时间可以显著改变我们对时间的感知。研究人员发现，在公园散步30分钟的参与者报告称，与在城市环境中散步的人相比，他们感觉时间过得更慢。\n\n该研究表明，大自然有助于将我们的注意力从眼前的关注点转移到未来需求和长期目标上。首席研究员莎拉·米切尔博士说：\"当我们被树木、水域和野生动物包围时，我们的思维自然就会慢下来。这也许可以解释为什么人们在户外度过时间后往往感到更加放松和头脑清醒。\"\n\n这些发现对城市规划和心理健康治疗具有重要意义。随着城市化和屏幕时间的增加，提供可达的绿色空间可能对公众福祉至关重要。此前的研究已经将自然接触与减少压力、改善情绪和更好的认知功能联系起来。\n\n米切尔建议说：\"下次当你感觉时间在流逝时，试着去公园散散步。这可能正是你需要的精神重置。\"",
        "vocab": [
          { "word": "immerse", "meaning": "沉浸，使置身于" },
          { "word": "profoundly", "meaning": "深刻地，极大地" },
          { "word": "perception", "meaning": "感知，看法" },
          { "word": "urbanization", "meaning": "城市化" },
          { "word": "cognitive", "meaning": "认知的" },
          { "word": "implications", "meaning": "影响，含义" },
          { "word": "accessible", "meaning": "可进入的，易获取的" }
        ]
      },
      {
        "date": "2026-06-03",
        "title": "Why Do Birds Sing at Dawn? The Science Behind Nature's Morning Chorus",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "Have you ever wondered why birds are most vocal in the early morning hours? Scientists call this phenomenon the \"dawn chorus,\" and it's one of nature's most remarkable acoustic displays.\n\nResearch from the University of Cambridge explains that male birds sing at dawn primarily to defend their territory and attract mates. The early morning provides optimal conditions: the air is still, which allows sound to travel farther, and it's too dark for most predators to hunt, making it safer to be conspicuous.\n\nInterestingly, different species join the chorus at different times. Robins and blackbirds are among the earliest singers, starting about an hour before sunrise, while finches and sparrows join later. This staggered schedule may have evolved to reduce acoustic competition between species.\n\nEnvironmental changes are affecting this ancient ritual. Light pollution in cities causes some birds to start singing earlier than their rural counterparts, potentially disrupting their breeding cycles. Noise pollution from traffic can also mask their calls, forcing birds to sing louder or at higher pitches.\n\nSo next time you hear that early morning melody, remember: you're listening to a sophisticated communication system millions of years in the making.",
        "translation": "你是否好奇过为什么鸟儿在清晨最为活跃？科学家将这种现象称为\"黎明合唱\"，它是自然界最引人注目的声学展示之一。\n\n剑桥大学的研究解释说，雄鸟在黎明唱歌主要是为了保卫领地和吸引配偶。清晨提供了最佳条件：空气静止，使声音传播更远，而且天太黑大多数捕食者无法捕猎，因此更容易引人注目也更安全。\n\n有趣的是，不同物种在不同的时间加入合唱。知更鸟和黑鸟是最早的歌手之一，在日出前约一小时开始，而雀鸟和麻雀则较晚加入。这种错开的时间表可能是为了减少物种之间的声音竞争而进化出来的。\n\n环境变化正在影响这一古老仪式。城市中的光污染导致一些鸟类比农村同类更早开始鸣叫，可能扰乱它们的繁殖周期。交通噪音也会掩盖它们的叫声，迫使鸟类唱得更大声或音调更高。\n\n所以下次你听到清晨的旋律时，请记住：你正在聆听的是一个经过数百万年演化的精密交流系统。",
        "vocab": [
          { "word": "vocal", "meaning": "发声的，声音的" },
          { "word": "phenomenon", "meaning": "现象" },
          { "word": "acoustic", "meaning": "声音的，听觉的" },
          { "word": "conspicuous", "meaning": "显眼的，引人注目的" },
          { "word": "staggered", "meaning": "错开的，交错的" },
          { "word": "counterpart", "meaning": "对应物，对方" },
          { "word": "sophisticated", "meaning": "复杂的，精密的" }
        ]
      },
      {
        "date": "2026-06-02",
        "title": "Made-in-China Sports Goods Surge Globally as Nation Becomes Top Exporter",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "China has emerged as the world's largest exporter of sporting goods, with global trade in sports equipment nearly tripling over the past three decades, according to a report by the World Trade Organization.\n\nThe report highlights that China now accounts for over 40% of global sports goods exports, driven by massive manufacturing capacity, technological innovation, and strong demand from both developed and emerging markets.\n\n\"Chinese sporting goods are no longer just about affordability,\" said Zhang Wei, an industry analyst. \"Companies like Anta, Li-Ning, and many others are now competing on quality, design, and innovation with established international brands.\"\n\nKey export categories include fitness equipment, outdoor gear, sportswear, and sports footwear. The surge has been particularly strong in smart fitness devices, where Chinese manufacturers are incorporating AI and IoT technologies.\n\nLooking ahead, industry experts expect continued growth as health consciousness rises globally and more countries invest in sports infrastructure. The upcoming Olympic Games and World Cup events are also expected to boost demand significantly.\n\nThis trend not only reflects China's manufacturing prowess but also its growing soft power in global sports culture.",
        "translation": "根据世界贸易组织的一份报告，中国已成为全球最大的体育用品出口国，过去三十年间体育器材的全球贸易额几乎增长了三倍。\n\n报告指出，中国目前占全球体育用品出口的40%以上，这得益于其庞大的制造能力、技术创新以及来自发达市场和新兴市场的强劲需求。\n\n行业分析师张伟表示：\"中国体育用品不再仅仅以价格优势取胜。安踏、李宁等许多企业现在正在质量、设计和创新方面与国际知名品牌竞争。\"\n\n主要出口类别包括健身器材、户外装备、运动服装和运动鞋。智能健身设备的增长尤为强劲，中国制造商正在其中融合人工智能和物联网技术。\n\n展望未来，随着全球健康意识的提升和更多国家投资体育基础设施，行业专家预计将持续增长。即将举办的奥运会和世界杯赛事也有望大幅推动需求。\n\n这一趋势不仅反映了中国的制造实力，也体现了其在全球体育文化中日益增长的软实力。",
        "vocab": [
          { "word": "surge", "meaning": "激增，飙升" },
          { "word": "emerge", "meaning": "出现，兴起" },
          { "word": "triple", "meaning": "三倍" },
          { "word": "innovation", "meaning": "创新" },
          { "word": "affordability", "meaning": "可负担性" },
          { "word": "infrastructure", "meaning": "基础设施" },
          { "word": "prowess", "meaning": "非凡的技能，造诣" }
        ]
      },
      {
        "date": "2026-06-01",
        "title": "Back to School! A Look at the Right Way to Start a New Semester",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "As millions of students across China return to school for a new semester, education experts are sharing advice on how to make the most of the fresh start. The beginning of a new term offers a unique opportunity to reset habits, set goals, and build momentum for academic success.\n\nDr. Li Ming, an education psychologist at Beijing Normal University, emphasizes the importance of the first two weeks. \"The habits students establish in the first 14 days of a semester often persist throughout the entire term,\" he explains. \"This is the ideal time to create a structured routine.\"\n\nKey recommendations include: setting specific, measurable academic goals; creating a dedicated study space free from distractions; establishing a consistent sleep schedule; and reviewing course syllabi to plan ahead for major assignments and exams.\n\nFor students preparing for competitive exams like the postgraduate entrance examination, experts suggest breaking large goals into weekly milestones. \"The journey of a thousand miles begins with a single step,\" Dr. Li quotes. \"Don't be overwhelmed by the big picture — focus on what you can accomplish today.\"\n\nMental health professionals also stress the importance of balancing study with physical activity and social connection. A healthy mind needs a healthy body, and isolation rarely leads to sustainable productivity.",
        "translation": "随着中国数百万学生返校开始新学期，教育专家们分享了如何充分利用这个新起点的建议。新学期的开始提供了一个独特的机会来重置习惯、设定目标，并为学业成功建立动力。\n\n北京师范大学教育心理学家李明博士强调了前两周的重要性。他解释说：\"学生在学期前14天建立的习惯往往会持续整个学期。这是建立有条理作息的理想时期。\"\n\n关键建议包括：设定具体、可衡量的学业目标；创建一个不受干扰的专属学习空间；建立一致的睡眠时间表；以及复习课程大纲，提前规划重要作业和考试。\n\n对于准备考研等竞争性考试的学生，专家建议将大目标分解为每周的里程碑。李博士引用道：\"千里之行始于足下。不要被全局所压倒——专注于你今天能完成的事情。\"\n\n心理健康专业人士还强调了平衡学习与体育活动和社会交往的重要性。健康的心智需要健康的身体，而孤立很少能带来可持续的生产力。",
        "vocab": [
          { "word": "semester", "meaning": "学期" },
          { "word": "momentum", "meaning": "动力，势头" },
          { "word": "structured", "meaning": "有结构的，有条理的" },
          { "word": "syllabi", "meaning": "教学大纲（复数）" },
          { "word": "milestone", "meaning": "里程碑" },
          { "word": "overwhelmed", "meaning": "不知所措的" },
          { "word": "sustainable", "meaning": "可持续的" }
        ]
      },
      {
        "date": "2026-05-31",
        "title": "US Economist Warns: Multiple Recession Red Lights Flashing for American Economy",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "A prominent US economist has issued a stark warning about the health of the American economy, pointing to multiple indicators that historically precede economic downturns. In a recent analysis published by the National Bureau of Economic Research, several \"recession red lights\" are now flashing simultaneously.\n\nKey warning signs include: an inverted yield curve that has persisted for over 18 months, declining consumer confidence, rising credit card delinquencies, and a slowdown in manufacturing activity. \"When you look at these indicators collectively, the picture is concerning,\" said Professor James Harrington of Harvard University.\n\nOf particular concern is the combination of persistent inflation and high interest rates, which has placed significant strain on American households. Recent surveys show that half of US credit card users carry month-to-month debt, with many struggling to make minimum payments.\n\n\"The Federal Reserve faces a difficult balancing act,\" Harrington noted. \"Cutting rates too soon could reignite inflation, but maintaining high rates for too long risks triggering a deeper recession.\"\n\nDespite these warnings, some economists remain cautiously optimistic, pointing to the resilience of the labor market and continued consumer spending as positive signs. The debate over whether a \"soft landing\" is still achievable continues to divide economic forecasters.",
        "translation": "一位知名美国经济学家对美国经济的健康状况发出了严酷警告，指出多项历史上先于经济衰退的指标正在亮起。在美国国家经济研究局最近发布的分析中，多个\"衰退红灯\"正在同时闪烁。\n\n主要预警信号包括：持续18个月以上的收益率曲线倒挂、消费者信心下降、信用卡违约率上升以及制造业活动放缓。哈佛大学教授詹姆斯·哈灵顿表示：\"当你综合审视这些指标时，情况令人担忧。\"\n\n尤其令人担忧的是持续通胀和高利率的组合，这给美国家庭带来了巨大压力。最近的调查显示，一半的美国信用卡用户背负月度债务，许多人在努力偿还最低还款额。\n\n哈灵顿指出：\"美联储面临着艰难的平衡之举。过早降息可能重新点燃通胀，但维持高利率过久又可能引发更深的衰退。\"\n\n尽管有这些警告，一些经济学家仍保持谨慎乐观，指出劳动力市场的韧性和持续的消费者支出是积极信号。关于\"软着陆\"是否仍可实现，经济预测人士仍在争论不休。",
        "vocab": [
          { "word": "stark", "meaning": "鲜明的，严酷的" },
          { "word": "downturn", "meaning": "衰退，下降" },
          { "word": "inverted yield curve", "meaning": "收益率曲线倒挂" },
          { "word": "delinquency", "meaning": "拖欠债务，逾期" },
          { "word": "persistent", "meaning": "持续的，持久的" },
          { "word": "resilience", "meaning": "韧性，恢复力" },
          { "word": "cautiously optimistic", "meaning": "谨慎乐观" }
        ]
      },
      {
        "date": "2026-05-30",
        "title": "China Ranks as World's Largest Industrial Robot Market for 11 Consecutive Years",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "China has maintained its position as the world's largest industrial robot market for 11 consecutive years, according to the latest data from the International Federation of Robotics. The country now accounts for more than half of all new industrial robot installations globally.\n\nThe rapid adoption of automation technologies spans multiple sectors, with the automotive, electronics, and metal industries leading the charge. China's manufacturing sector has been aggressively upgrading to smart factories, driven by rising labor costs and government policies promoting high-tech development.\n\n\"The robot density in China's manufacturing industry has reached 392 units per 10,000 workers, surpassing the United States for the first time,\" the report states. This metric, which measures automation levels, has more than doubled in China over the past five years.\n\nChinese robotics companies are also becoming major players on the global stage. Domestic brands now hold over 35% of the domestic market share, up from less than 20% five years ago. Companies like Siasun, Estun, and others are increasingly competing with established players from Japan, Germany, and Switzerland.\n\nLooking forward, the integration of AI with robotics is expected to drive the next wave of growth. Collaborative robots, or \"cobots,\" that can safely work alongside humans are a particularly promising area, with applications in healthcare, logistics, and service industries.",
        "translation": "根据国际机器人联合会的最新数据，中国已连续11年保持全球最大工业机器人市场的地位。该国目前占全球新安装工业机器人的半数以上。\n\n自动化技术的快速应用遍及多个行业，汽车、电子和金属行业走在前列。在劳动力成本上升和政府推动高科技发展政策的驱动下，中国制造业正在大力推进智能工厂升级。\n\n报告指出：\"中国制造业的机器人密度已达到每万名工人392台，首次超越美国。\"这一衡量自动化水平的指标在过去五年中在中国的增幅超过了一倍。\n\n中国机器人企业也正在成为全球舞台上的重要参与者。国产品牌目前占据国内市场份额的35%以上，比五年前不到20%的比例大幅提升。新松、埃斯顿等企业正日益与来自日本、德国和瑞士的老牌企业展开竞争。\n\n展望未来，人工智能与机器人的融合预计将推动下一波增长。协作机器人（\"cobots\"）能够安全地与人类并肩工作，是一个特别有前景的领域，可应用于医疗、物流和服务行业。",
        "vocab": [
          { "word": "consecutive", "meaning": "连续的" },
          { "word": "automation", "meaning": "自动化" },
          { "word": "density", "meaning": "密度" },
          { "word": "metric", "meaning": "指标，度量标准" },
          { "word": "domestic", "meaning": "国内的" },
          { "word": "integration", "meaning": "整合，融合" },
          { "word": "collaborative", "meaning": "协作的" }
        ]
      },
      {
        "date": "2026-05-29",
        "title": "Black Myth: Wukong Goes Global — Chinese Culture Shines on the World Stage",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "The Chinese-developed video game \"Black Myth: Wukong\" has taken the global gaming world by storm, selling over 20 million copies within its first month of release and earning widespread critical acclaim. Based on the classic Chinese novel \"Journey to the West,\" the game represents a watershed moment for Chinese cultural exports.\n\nDeveloped by Game Science, a Hangzhou-based studio, the game features stunning graphics powered by Unreal Engine 5 and deep combat mechanics inspired by the Souls-like genre. But what truly sets it apart is its rich incorporation of Chinese mythology, architecture, and philosophy.\n\n\"This is not just a game — it's a cultural ambassador,\" said Professor Chen Yu of the Chinese Academy of Social Sciences. \"For millions of players around the world, this may be their first meaningful encounter with traditional Chinese culture.\"\n\nThe game's success has sparked renewed global interest in \"Journey to the West,\" with international bookstores reporting a surge in sales of English translations. Tourism to locations featured in the game, such as the ancient temples of Shanxi province, has also seen a dramatic increase.\n\nIndustry analysts see Black Myth: Wukong as a turning point for China's gaming industry, proving that high-quality, culturally distinctive games can compete with the best offerings from the US, Japan, and Europe. Several other Chinese studios have announced similar projects based on Chinese mythology.",
        "translation": "中国开发的电子游戏《黑神话：悟空》风靡全球游戏界，发售首月销量超过2000万份，获得广泛好评。该游戏以中国古典小说《西游记》为基础，代表了中国文化出口的一个分水岭时刻。\n\n该游戏由杭州的游戏科学工作室开发，采用虚幻5引擎驱动的惊艳画面和受魂类游戏启发的深度战斗机制。但真正让它脱颖而出的是对中国神话、建筑和哲学的丰富融合。\n\n中国社会科学院陈宇教授说：\"这不仅仅是一款游戏——它是一位文化大使。对于全球数百万玩家来说，这可能是他们与中国传统文化的第一次有意义的接触。\"\n\n该游戏的成功重新激发了全球对《西游记》的兴趣，国际书店报告英文翻译版销量激增。游戏中出现的地点，如山西省的古寺庙，旅游人数也大幅增加。\n\n行业分析师将《黑神话：悟空》视为中国游戏行业的转折点，证明高质量、文化特色鲜明的游戏可以与美国、日本和欧洲最优秀的作品竞争。其他几家中国工作室已宣布了类似的中国神话项目。",
        "vocab": [
          { "word": "watershed", "meaning": "分水岭，转折点" },
          { "word": "mythology", "meaning": "神话" },
          { "word": "incorporation", "meaning": "融合，纳入" },
          { "word": "ambassador", "meaning": "大使，代表" },
          { "word": "spark", "meaning": "引发，激起" },
          { "word": "dramatic", "meaning": "巨大的，戏剧性的" },
          { "word": "distinctive", "meaning": "独特的，有特色的" }
        ]
      },
      {
        "date": "2026-05-28",
        "title": "Poll: Half of US Credit Card Users Carry Debt as Inflation Bites",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "A new survey reveals that approximately 50% of American credit card users are now carrying month-to-month debt, a significant increase from pre-pandemic levels. The findings, released by Bankrate, highlight the growing financial pressure on US households amid persistent inflation and high interest rates.\n\nThe average credit card interest rate has surged to over 22%, the highest level in decades, making it increasingly difficult for borrowers to pay down their balances. \"Many families are using credit cards not for discretionary spending, but for basic necessities like groceries and utilities,\" said Sarah Foster, a senior analyst at Bankrate.\n\nThe survey found that younger generations are particularly affected, with nearly 60% of millennials and Gen Z cardholders carrying debt. Rising housing costs and student loan payments compound the problem, leaving many with little room in their budgets for emergencies.\n\nFinancial advisors recommend several strategies for those struggling with credit card debt: consolidating balances to lower-interest options, negotiating with creditors for reduced rates, and creating a strict budget that prioritizes debt repayment. However, they acknowledge that for many Americans, these solutions may not be enough without broader economic relief.\n\nThe data underscores a troubling trend: as the cost of living continues to rise faster than wages, more Americans are falling into a debt trap that becomes increasingly difficult to escape.",
        "translation": "一项新调查显示，约50%的美国信用卡用户现在背负月度债务，比疫情前水平显著增加。Bankrate发布的这些发现凸显了在持续通胀和高利率背景下美国家庭日益增长的经济压力。\n\n平均信用卡利率已飙升至22%以上，为数十年来最高水平，使借款人越来越难以偿还余额。Bankrate高级分析师莎拉·福斯特表示：\"许多家庭使用信用卡不是为了自由支配支出，而是为了购买食品杂货和水电等基本生活必需品。\"\n\n调查发现年轻一代受影响尤为严重，近60%的千禧一代和Z世代持卡人背负债务。不断上涨的住房成本和学生贷款还款使问题雪上加霜，许多人的预算中没有多少应急空间。\n\n理财顾问为那些苦苦偿还信用卡债务的人推荐了几种策略：将余额合并到较低利率的选项、与债权人协商降低利率、以及制定优先偿还债务的严格预算。但他们承认，对于许多美国人来说，如果没有更广泛的经济救济，这些解决方案可能还不够。\n\n这些数据凸显了一个令人担忧的趋势：随着生活成本持续上升速度超过工资增长，越来越多的美国人陷入了越来越难以逃脱的债务陷阱。",
        "vocab": [
          { "word": "approximately", "meaning": "大约，近似" },
          { "word": "discretionary", "meaning": "自由支配的" },
          { "word": "compound", "meaning": "加重，使恶化" },
          { "word": "consolidate", "meaning": "合并，整合" },
          { "word": "negotiate", "meaning": "谈判，协商" },
          { "word": "underscore", "meaning": "强调，凸显" },
          { "word": "broader", "meaning": "更广泛的" }
        ]
      },
      {
        "date": "2026-05-27",
        "title": "Is It True That Type O Blood Attracts More Mosquitoes?",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "Have you ever noticed that some people seem to be mosquito magnets while others remain bite-free? The idea that blood type influences mosquito attraction has circulated for years — but what does science actually say?\n\nResearch published in the Journal of Medical Entomology suggests there may be some truth to the claim. In a controlled study, mosquitoes landed on people with Type O blood nearly twice as often as those with Type A blood. Type B fell somewhere in between.\n\nBut blood type is just one factor in a complex equation. Scientists have identified several other reasons why mosquitoes might prefer certain individuals: carbon dioxide output (larger people and pregnant women exhale more), body heat, sweat composition, and even the bacteria living on our skin.\n\n\"About 85% of mosquito attraction is actually determined by genetics,\" explains Dr. Jonathan Day, a medical entomologist at the University of Florida. \"The specific cocktail of chemicals your body emits — many of which are genetically determined — is what really draws mosquitoes in.\"\n\nPractical advice for avoiding bites remains the same regardless of blood type: wear long sleeves and pants in mosquito-prone areas, use EPA-approved insect repellents containing DEET or picaridin, eliminate standing water around your home, and avoid being outdoors during peak mosquito hours at dawn and dusk.\n\nSo while your Type O blood might make you slightly more appealing to mosquitoes, it's just one piece of a much larger puzzle.",
        "translation": "你是否注意到有些人似乎是蚊子磁铁，而其他人却能安然无恙？血型影响蚊子吸引力的说法流传已久——但科学实际上怎么说？\n\n发表在《医学昆虫学杂志》上的研究表明，这种说法可能有一定道理。在一项对照研究中，蚊子落在O型血人身上的次数几乎是A型血人的两倍。B型血则介于两者之间。\n\n但血型只是这个复杂方程中的一个因素。科学家确定了蚊子可能偏爱某些人的其他几个原因：二氧化碳排放量（体型较大的人和孕妇呼出更多）、体温、汗液成分，甚至我们皮肤上生活的细菌。\n\n佛罗里达大学医学昆虫学家乔纳森·戴博士解释说：\"大约85%的蚊子吸引力实际上是由基因决定的。你身体释放的特定化学混合物——其中许多是由基因决定的——才是真正吸引蚊子的东西。\"\n\n无论血型如何，避免叮咬的实用建议都是一样的：在蚊子高发地区穿长袖长裤、使用含避蚊胺或派卡瑞丁的EPA批准驱虫剂、清除家中周围的积水、以及避免在黎明和黄昏蚊子高峰时段外出。\n\n所以虽然你的O型血可能让你对蚊子稍微更有吸引力，但这只是更大谜题中的一小部分。",
        "vocab": [
          { "word": "magnet", "meaning": "磁铁，有吸引力的人或物" },
          { "word": "circulate", "meaning": "流传，循环" },
          { "word": "entomology", "meaning": "昆虫学" },
          { "word": "exhale", "meaning": "呼出" },
          { "word": "genetics", "meaning": "遗传学" },
          { "word": "cocktail", "meaning": "混合物" },
          { "word": "repellent", "meaning": "驱虫剂" }
        ]
      },
      {
        "date": "2026-05-26",
        "title": "Study Finds Watching Short Videos Makes People Feel More Bored",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "In an ironic twist, researchers have found that watching short-form videos — the very activity millions turn to when they feel bored — may actually increase feelings of boredom rather than alleviate them. The study, published in the Journal of Experimental Psychology, challenges the assumption that quick digital content consumption is an effective boredom cure.\n\nResearchers from the University of Toronto conducted a series of experiments where participants were asked to watch short video clips, switching between them frequently, versus watching a single longer video. Those who switched between short videos reported significantly higher levels of boredom and lower satisfaction.\n\n\"The constant switching prevents meaningful engagement,\" explained Dr. Katy Tam, lead author of the study. \"Each video provides a brief dopamine hit, but without deeper processing, the brain quickly adapts and craves more stimulation. It's a cycle that leaves people feeling emptier than before.\"\n\nThe findings have implications for the billions of users who spend hours daily on platforms like TikTok, Instagram Reels, and YouTube Shorts. While these platforms are designed to be addictive, the research suggests they may paradoxically undermine the very satisfaction users seek.\n\nExperts recommend that instead of reaching for short videos when bored, people try activities that require more active engagement: reading a book, having a conversation, learning a new skill, or simply sitting with the feeling of boredom — which research shows can actually spark creativity.",
        "translation": "讽刺的是，研究人员发现观看短视频——正是数百万人感到无聊时会选择的活动——实际上可能增加而非缓解无聊感。这项发表在《实验心理学杂志》上的研究挑战了快速数字内容消费是有效无聊解药的假设。\n\n多伦多大学的研究人员进行了一系列实验，要求参与者频繁切换短视频片段观看，对比观看单个较长视频。那些频繁切换短视频的人报告的无聊程度明显更高，满意度更低。\n\n研究主要作者凯蒂·谭博士解释说：\"不断切换阻碍了有意义的参与。每个视频提供短暂的多巴胺刺激，但如果没有更深入的处理，大脑很快就会适应并渴望更多刺激。这是一个让人感到比之前更空虚的循环。\"\n\n这些发现对每天在TikTok、Instagram Reels和YouTube Shorts等平台上花费数小时的数十亿用户具有启示意义。虽然这些平台被设计为令人上瘾，但研究表明它们可能矛盾地削弱了用户所追求的满足感。\n\n专家建议，无聊时不要看短视频，而是尝试需要更多主动参与的活动：读书、与人交谈、学习一项新技能，或者只是静静地感受无聊——研究表明这实际上可以激发创造力。",
        "vocab": [
          { "word": "ironic", "meaning": "讽刺的" },
          { "word": "alleviate", "meaning": "缓解，减轻" },
          { "word": "dopamine", "meaning": "多巴胺" },
          { "word": "crave", "meaning": "渴望，渴求" },
          { "word": "paradoxically", "meaning": "矛盾的是" },
          { "word": "undermine", "meaning": "削弱，破坏" },
          { "word": "engagement", "meaning": "参与，投入" }
        ]
      },
      {
        "date": "2026-05-25",
        "title": "Poll: Cost of Living Tops Americans' Concerns as Inflation Persists",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "A comprehensive Ipsos poll has revealed that 50% of Americans now rank the cost of living as their top concern, surpassing healthcare, crime, and immigration. The findings reflect the deep impact of persistent inflation on American households despite official data showing some moderation in price increases.\n\nThe survey highlights a growing disconnect between macroeconomic indicators and the lived experience of ordinary citizens. While headline inflation has cooled from its 2022 peak, cumulative price increases over the past three years have left many essentials — food, housing, energy — significantly more expensive than before the pandemic.\n\n\"People don't feel inflation as a percentage — they feel it at the grocery checkout and when paying rent,\" said Cliff Young, president of Ipsos US Public Affairs. \"Even if inflation slows, prices are still high, and wages haven't kept up.\"\n\nThe financial strain is affecting mental health as well. A related survey found that high living costs are harming American families' psychological well-being, with half of respondents expressing deep anxiety about their financial future. Many report cutting back on non-essential spending, delaying major purchases, and dipping into savings to cover daily expenses.\n\nEconomists note that while the Federal Reserve's interest rate hikes have helped curb inflation, the full effects on household budgets will take time to resolve. For many Americans, the question is not whether the economy is improving on paper, but whether they can afford next month's bills.",
        "translation": "益普索的一项全面民意调查显示，50%的美国人现在将生活成本列为头等关切，超过了医疗、犯罪和移民。这些发现反映了持续通胀对美国家庭的深刻影响，尽管官方数据显示价格上涨有所缓和。\n\n调查凸显了宏观经济指标与普通公民实际生活体验之间日益增大的脱节。虽然总体通胀已从2022年的峰值回落，但过去三年累积的价格上涨使许多必需品——食品、住房、能源——比疫情前显著更贵。\n\n益普索美国公共事务总裁克里夫·杨说：\"人们不是以百分比来感受通胀的——他们是在超市结账和交房租时感受到的。即使通胀放缓，物价仍然很高，而工资没有跟上。\"\n\n经济压力也影响了心理健康。一项相关调查发现，高生活成本正在损害美国家庭的心理健康，半数受访者对财务未来表达深切焦虑。许多人报告削减非必要开支、推迟大额购买、动用储蓄来支付日常费用。\n\n经济学家指出，虽然美联储的加息有助于抑制通胀，但对家庭预算的全面影响还需要时间来缓解。对许多美国人来说，问题不是经济是否在纸面上改善，而是他们能否负担下个月的账单。",
        "vocab": [
          { "word": "comprehensive", "meaning": "全面的，综合的" },
          { "word": "moderation", "meaning": "缓和，适度" },
          { "word": "cumulative", "meaning": "累积的" },
          { "word": "strain", "meaning": "压力，负担" },
          { "word": "psychological", "meaning": "心理的" },
          { "word": "dip into", "meaning": "动用（储蓄）" },
          { "word": "curb", "meaning": "控制，抑制" }
        ]
      },
      {
        "date": "2026-05-24",
        "title": "Shanghai Optimizes Housing Standards for Small and Medium-Sized Apartments",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "Shanghai has announced new standards for small and medium-sized residential units, increasing the maximum allowable floor area in a move aimed at better meeting the housing needs of urban residents. The policy adjustment reflects the evolving demands of China's metropolitan housing market.\n\nThe updated standards raise the maximum floor area for \"small\" apartments from 90 to 100 square meters, and for \"medium\" apartments from 140 to 150 square meters. This change allows developers greater flexibility in designing residential projects while still maintaining affordability targets.\n\n\"The previous standards were set more than a decade ago and no longer reflect current living patterns,\" said Wang Jian, a real estate analyst. \"Today's families have different space requirements, especially with more people working from home.\"\n\nThe policy is part of a broader effort to stabilize China's real estate market, which has experienced significant turbulence in recent years. By optimizing housing standards, Shanghai aims to stimulate demand while ensuring that new developments better serve the needs of residents.\n\nIndustry experts view the adjustment as a pragmatic step that balances multiple objectives: supporting the construction sector, providing better housing options for families, and maintaining the city's commitment to controlled urban development. Similar policy adjustments are expected in other major Chinese cities in the coming months.",
        "translation": "上海宣布了中小型住宅的新标准，提高了最大允许建筑面积，旨在更好地满足城市居民的住房需求。这一政策调整反映了中国大都市住房市场不断变化的需求。\n\n新标准将\"小\"型公寓的最大建筑面积从90平方米提高到100平方米，\"中\"型公寓从140平方米提高到150平方米。这一变化为开发商在设计住宅项目时提供了更大的灵活性，同时仍保持可负担性目标。\n\n房地产分析师王建表示：\"此前的标准是十多年前制定的，已不再反映当前的居住模式。如今的家庭有不同的空间需求，特别是越来越多的人在家办公。\"\n\n这项政策是稳定中国房地产市场的更广泛努力的一部分，该市场近年来经历了显著波动。通过优化住房标准，上海旨在刺激需求，同时确保新开发项目更好地服务居民需求。\n\n行业专家将这一调整视为平衡多重目标的务实之举：支持建筑行业、为家庭提供更好的住房选择，以及维持城市对受控城市发展的承诺。预计其他中国主要城市也将在未来数月进行类似的政策调整。",
        "vocab": [
          { "word": "optimize", "meaning": "优化" },
          { "word": "metropolitan", "meaning": "大都市的" },
          { "word": "flexibility", "meaning": "灵活性" },
          { "word": "turbulence", "meaning": "动荡，波动" },
          { "word": "stimulate", "meaning": "刺激，促进" },
          { "word": "pragmatic", "meaning": "务实的" },
          { "word": "commitment", "meaning": "承诺，投入" }
        ]
      },
      {
        "date": "2026-05-23",
        "title": "Luckin Coffee Plans Massive Overseas Expansion by Year-End",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "Luckin Coffee, China's largest coffee chain by store count, has announced ambitious plans for a major international expansion by the end of 2026. The company, which staged a remarkable recovery after a high-profile accounting scandal in 2020, now operates over 20,000 stores across China.\n\nThe overseas push will target Southeast Asian markets initially, including Singapore, Malaysia, and Thailand, where coffee consumption is growing rapidly among young urban consumers. Luckin's competitive advantage lies in its technology-driven model, which emphasizes mobile ordering, data-driven store placement, and aggressive pricing.\n\n\"We've proven our model works at massive scale in China,\" said Guo Jinyi, Luckin's chairman and CEO. \"Now we're ready to bring our affordable, convenient coffee experience to international markets.\"\n\nThe expansion comes as Luckin has successfully rebuilt its brand reputation and financial standing. The company reported revenue of over 30 billion yuan in 2025, with profit margins that rival established global chains. Its partnership with Kweichow Moutai for the famous \"sauce-flavored latte\" demonstrated its marketing prowess and ability to create viral products.\n\nAnalysts see the international push as a test of whether Chinese consumer brands can successfully expand abroad — a challenge that few have mastered. Competition will be fierce, with Starbucks and local chains already well-established in target markets.",
        "translation": "瑞幸咖啡——中国门店数量最大的咖啡连锁品牌——宣布了到2026年底进行大规模国际扩张的雄心计划。该公司在2020年备受瞩目的财务造假丑闻后实现了惊人复苏，目前在中国运营超过2万家门店。\n\n海外扩张将首先瞄准东南亚市场，包括新加坡、马来西亚和泰国，这些地区年轻城市消费者的咖啡消费量正在快速增长。瑞幸的竞争优势在于其技术驱动模式，强调移动下单、数据驱动的门店选址和激进定价策略。\n\n瑞幸董事长兼CEO郭谨一说：\"我们已经证明了我们的模式在中国大规模运营是成功的。现在我们准备将平价、便捷的咖啡体验带到国际市场。\"\n\n此次扩张之际，瑞幸已成功重建了品牌声誉和财务状况。该公司2025年报告收入超过300亿元，利润率可与知名全球连锁品牌匹敌。其与贵州茅台合作推出的\"酱香拿铁\"展示了其营销实力和创造爆款产品的能力。\n\n分析师将这一国际扩张视为中国消费品牌能否成功走向海外的考验——这是一个很少有人掌握的挑战。竞争将非常激烈，星巴克和当地连锁品牌已在目标市场站稳脚跟。",
        "vocab": [
          { "word": "ambitious", "meaning": "雄心勃勃的" },
          { "word": "scandal", "meaning": "丑闻" },
          { "word": "aggressive", "meaning": "激进的，进取的" },
          { "word": "reputation", "meaning": "声誉，名声" },
          { "word": "rival", "meaning": "与…匹敌，竞争对手" },
          { "word": "prowess", "meaning": "卓越技能" },
          { "word": "fierce", "meaning": "激烈的" }
        ]
      },
      {
        "date": "2026-05-22",
        "title": "Solar Terms: Six Things You May Not Know About the End of Heat",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "The traditional Chinese solar calendar divides the year into 24 solar terms, each with its own customs and significance. \"Chushu,\" or the End of Heat, is the 14th solar term, typically falling around August 23, marking the transition from summer to autumn.\n\nHere are six fascinating facts about this ancient marker of seasonal change: First, despite its name, the End of Heat does not mean the hot weather disappears immediately — the \"Autumn Tiger\" can still bring sweltering days. Second, this is traditionally the season for eating duck, believed to have cooling properties according to Traditional Chinese Medicine.\n\nThird, fishermen in coastal regions hold ceremonies during this period, as it marks the end of the summer fishing ban and the beginning of the harvest season at sea. Fourth, the solar term coincides with the blooming of night-blooming cereus, a flower that blossoms only at night and wilts by dawn.\n\nFifth, in many parts of China, people release river lanterns during the End of Heat to pray for safety and good fortune. This tradition dates back to ancient times when people believed that lanterns could guide lost souls and bring blessings.\n\nFinally, the End of Heat is considered an important time for health preservation in Chinese culture. The transition between seasons is believed to be a vulnerable period for the body, and traditional wisdom emphasizes adjusting diet and lifestyle accordingly — eating more seasonal fruits and vegetables, maintaining regular sleep patterns, and engaging in moderate exercise.",
        "translation": "中国传统农历将一年分为24个节气，每个节气都有自己的习俗和意义。\"处暑\"是第14个节气，通常在8月23日前后，标志着从夏天到秋天的过渡。\n\n关于这个古老的季节变化标志，有六个有趣的事实：首先，尽管名字如此，处暑并不意味着炎热天气立即消失——\"秋老虎\"仍然可以带来闷热的日子。其次，这传统上是吃鸭子的季节，根据中医理论，鸭肉被认为具有清凉属性。\n\n第三，沿海地区的渔民在此期间举行仪式，因为它标志着夏季休渔期的结束和海上捕捞季的开始。第四，这个节气恰好与昙花开放的时间重合，昙花只在夜间开放，到黎明便凋谢。\n\n第五，在中国许多地方，人们在处暑期间放河灯，祈求平安和好运。这一传统可以追溯到古代，人们相信灯笼可以引路迷途的灵魂并带来祝福。\n\n最后，在中国文化中，处暑被认为是养生的重要时期。季节交替被认为是身体最脆弱的时候，传统智慧强调相应调整饮食和生活方式——多吃时令水果和蔬菜、保持规律作息、以及适度运动。",
        "vocab": [
          { "word": "solar term", "meaning": "节气" },
          { "word": "sweltering", "meaning": "闷热的" },
          { "word": "coincide", "meaning": "同时发生，巧合" },
          { "word": "wilt", "meaning": "枯萎" },
          { "word": "lantern", "meaning": "灯笼" },
          { "word": "vulnerable", "meaning": "脆弱的，易受伤的" },
          { "word": "preservation", "meaning": "保养，保存" }
        ]
      },
      {
        "date": "2026-05-21",
        "title": "Foreign Experts Warn: US Economic Recession Is Imminent",
        "source": "China Daily 英语点津",
        "url": "https://language.chinadaily.com.cn/news_bilingual",
        "content": "A growing chorus of international economists and financial experts is warning that the United States may be heading toward an imminent recession, citing a confluence of negative economic indicators that have historically preceded downturns.\n\nAmong the most cited warning signs are: the longest yield curve inversion in modern history, declining manufacturing activity for eight consecutive months, rising unemployment claims, and consumer debt reaching record levels. \"When you look at the data objectively, the probability of a recession in the next 12 months is uncomfortably high,\" said Dr. Michael Roberts, an economist at the London School of Economics.\n\nThe warnings come as the Federal Reserve maintains its high interest rate policy to combat inflation, a strategy that historically slows economic growth. Critics argue the Fed may be overcorrecting, risking unnecessary damage to the broader economy.\n\nInternational implications are significant. A US recession would likely trigger ripple effects across global financial markets, affecting trade flows, commodity prices, and emerging market economies. Asian economies, which depend heavily on exports to the US, would be particularly vulnerable.\n\nHowever, not all experts agree on the severity of the outlook. Some point to the resilience of the US labor market and strong corporate earnings as reasons for cautious optimism. The debate reflects the fundamental uncertainty inherent in economic forecasting — a reminder that even the most sophisticated models can be wrong.",
        "translation": "越来越多的国际经济学家和金融专家警告称，美国可能正走向即将到来的经济衰退，指出多项历史上先于衰退出现的负面经济指标同时出现。\n\n最常被引用的预警信号包括：现代史上最长的收益率曲线倒挂、制造业活动连续八个月下降、失业救济申请上升以及消费者债务达到创纪录水平。伦敦经济学院经济学家迈克尔·罗伯茨博士说：\"如果你客观地看数据，未来12个月发生衰退的概率高得令人不安。\"\n\n这些警告出现在美联储维持高利率政策以对抗通胀之际，这一策略历史上会减缓经济增长。批评者认为美联储可能过度修正，冒着对更广泛经济造成不必要损害的风险。\n\n国际影响是重大的。美国衰退可能在全球金融市场引发连锁反应，影响贸易流动、大宗商品价格和新兴市场经济体。严重依赖对美出口的亚洲经济体将尤其脆弱。\n\n然而，并非所有专家都认同前景的严重程度。一些人指出美国劳动力市场的韧性和强劲的企业盈利作为谨慎乐观的理由。这场争论反映了经济预测中固有的根本不确定性——提醒人们即使最精密的模型也可能出错。",
        "vocab": [
          { "word": "imminent", "meaning": "即将发生的，临近的" },
          { "word": "confluence", "meaning": "汇合，同时发生" },
          { "word": "objectively", "meaning": "客观地" },
          { "word": "overcorrecting", "meaning": "过度修正" },
          { "word": "ripple effect", "meaning": "连锁反应" },
          { "word": "commodity", "meaning": "商品，大宗商品" },
          { "word": "inherent", "meaning": "固有的，内在的" }
        ]
      }
    ];
  }
};
