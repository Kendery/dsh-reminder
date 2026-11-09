/**
 * 老黄历：农历、干支、节气、建除十二神、宜忌、彭祖百忌。
 *
 * 这部分交给 lunar-javascript —— 自己写干支和节气很容易错一天，
 * 而这个库是纯 JS、无原生依赖，只在 host 侧用。
 */

import lunarPackage from 'lunar-javascript'

const { Solar } = lunarPackage

/**
 * 十二星座：名称、元素（火/土/风/水）、守护星、日期区间。
 * 只做客观映射，不生成“今日运势”。
 */
const ZODIAC = {
  白羊: { element: '火象', ruler: '火星', range: '3/21 – 4/19' },
  金牛: { element: '土象', ruler: '金星', range: '4/20 – 5/20' },
  双子: { element: '风象', ruler: '水星', range: '5/21 – 6/21' },
  巨蟹: { element: '水象', ruler: '月亮', range: '6/22 – 7/22' },
  狮子: { element: '火象', ruler: '太阳', range: '7/23 – 8/22' },
  处女: { element: '土象', ruler: '水星', range: '8/23 – 9/22' },
  天秤: { element: '风象', ruler: '金星', range: '9/23 – 10/23' },
  天蝎: { element: '水象', ruler: '冥王星', range: '10/24 – 11/22' },
  射手: { element: '火象', ruler: '木星', range: '11/23 – 12/21' },
  摩羯: { element: '土象', ruler: '土星', range: '12/22 – 1/19' },
  水瓶: { element: '风象', ruler: '天王星', range: '1/20 – 2/18' },
  双鱼: { element: '水象', ruler: '海王星', range: '2/19 – 3/20' },
}

/** 星座信息：{ sign, element, ruler, range }，sign 不带“座”字 */
export function zodiacOf(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const sign = Solar.fromYmd(year, month, day).getXingZuo()
  const meta = ZODIAC[sign] ?? { element: '', ruler: '', range: '' }
  return { sign, ...meta }
}

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {{ lunarDay: string, lunarText: string, ganzhi: string, jieQi: string,
 *             zhiXing: string, yi: string[], ji: string[], pengZu: string, week: string }}
 */
export function almanacOf(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()

  return {
    lunarDay: lunar.getDayInChinese(),
    lunarText: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    ganzhi: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    jieQi: lunar.getJieQi() || '',
    zhiXing: lunar.getZhiXing(),
    yi: lunar.getDayYi() || [],
    ji: lunar.getDayJi() || [],
    pengZu: `${lunar.getPengZuGan()} ${lunar.getPengZuZhi()}`,
    week: solar.getWeekInChinese(),
    yueXiang: lunar.getYueXiang(),
    // 黄道吉时：时辰的天神类型为「黄道」
    jiShi: lunar.getTimes()
      .filter((time) => time.getTianShenType() === '黄道')
      .map((time) => ({ zhi: time.getZhi(), from: time.getMinHm(), to: time.getMaxHm() })),
    xiu: `${lunar.getXiu()}${lunar.getZheng()}${lunar.getAnimal()}`,
    xiuLuck: lunar.getXiuLuck(),
    naYin: lunar.getDayNaYin(),
    positions: {
      xi: lunar.getDayPositionXiDesc(),
      fu: lunar.getDayPositionFuDesc(),
      cai: lunar.getDayPositionCaiDesc(),
    },
    chong: lunar.getDayChongDesc(),
    sha: lunar.getDaySha(),
    tianShen: lunar.getDayTianShen(),
    tianShenType: lunar.getDayTianShenType(),
    jiShen: lunar.getDayJiShen() || [],
    xiongSha: lunar.getDayXiongSha() || [],
    zodiac: zodiacOf(iso),
  }
}
