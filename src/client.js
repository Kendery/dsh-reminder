/**
 * 浏览器面：手写的 CJS 工厂，不经过构建。
 *
 * 形状必须与 dsh.client 包的 ./client 导出一致：
 *   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
 * 只有 react / react-dom / ui-primitives 是平台外置的，这里只用到 react。
 */
window.__ModuleLoader__.load({
  id: '@sunr/dsh-reminder',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement

    const ROUTE = '/api/dsh-reminder/items'
    const ACCENT = 'var(--dsw-accent, #4f6ef7)'
    const BORDER = 'var(--dsw-border, rgba(127,127,127,.25))'
    const MUTED = 'var(--dsw-text-secondary, #888)'
    const DANGER = 'var(--dsw-danger, #d33)'

    const KIND_OPTIONS = [['anniversary', '纪念日'], ['todo', '待办'], ['memo', '备忘']]
    const REPEAT_OPTIONS = [
      ['none', '不重复'], ['yearly', '每年'], ['monthly', '每月'], ['weekly', '每周'],
      ['daily', '每天'], ['biweeklyOdd', '单周'], ['biweeklyEven', '双周'], ['customDays', '每 N 天'],
    ]
    const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
    const PALETTE = ['#4f6ef7', '#e5484d', '#f5a524', '#30a46c', '#8e4ec6', '#0ea5e9', '#d6409f', '#f76b15']

    function colorOf(id) {
      let hash = 0
      for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
      return PALETTE[hash % PALETTE.length]
    }

    const styles = {
      wrap: { padding: '20px 24px 32px', overflow: 'auto', height: '100%', boxSizing: 'border-box' },
      header: { display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px', flexWrap: 'wrap' },
      title: { margin: 0, fontSize: 18, fontWeight: 600, marginRight: 4 },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
      th: { textAlign: 'left', padding: '8px 10px', color: MUTED, fontWeight: 500, borderBottom: `1px solid ${BORDER}` },
      td: { padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'baseline' },
      badge: { display: 'inline-block', padding: '1px 6px', marginLeft: 6, borderRadius: 4, fontSize: 11, background: 'rgba(127,127,127,.14)', color: MUTED },
      soon: { color: ACCENT, fontWeight: 600 },
      overdue: { color: DANGER, fontWeight: 600 },
      muted: { padding: 16, color: MUTED, fontSize: 13 },
      error: { padding: '10px 12px', margin: '0 0 12px', color: DANGER, fontSize: 12, border: `1px solid ${DANGER}`, borderRadius: 6 },
      button: { border: `1px solid ${BORDER}`, background: 'transparent', color: 'inherit', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
      primary: { border: 'none', background: ACCENT, color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
      linkButton: { border: 'none', background: 'transparent', color: MUTED, fontSize: 12, cursor: 'pointer', padding: '2px 6px' },
      form: { border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, margin: '0 0 16px', display: 'grid', gap: 10, maxWidth: 640 },
      field: { display: 'grid', gap: 4 },
      fieldLabel: { fontSize: 12, color: MUTED },
      input: { padding: '6px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent', color: 'inherit', fontSize: 13, fontFamily: 'inherit' },
      row: { display: 'flex', gap: 8, alignItems: 'center' },
      chip: { border: `1px solid ${BORDER}`, background: 'transparent', color: 'inherit', borderRadius: 999, padding: '2px 9px', fontSize: 12, cursor: 'pointer' },
      chipOn: { border: 'none', background: ACCENT, color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 12, cursor: 'pointer' },
      actions: { display: 'flex', gap: 4, justifyContent: 'flex-end' },
      calBar: { display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 8px' },
      calTitle: { fontSize: 14, fontWeight: 600, minWidth: 110 },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, maxWidth: 820 },
      weekGrid: { display: 'grid', gridTemplateColumns: '46px repeat(7, minmax(0, 1fr))', gap: 4, maxWidth: 720 },
      calRow: { display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap', maxWidth: 1080 },
      calCol: { flex: '2 1 540px', minWidth: 0 },
      sideCol: { flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'stretch' },
      retroMark: { position: 'absolute', top: 3, right: 4, fontSize: 9, color: '#e5484d', fontWeight: 700 },
      cardSide: { flex: 'none' },
      strip: { display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 8, maxWidth: 720 },
      compactHead: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 },
      compactScroll: { maxHeight: 300, overflow: 'auto', display: 'grid', gap: 2 },
      compactRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderTop: `1px solid ${BORDER}`, minWidth: 0 },
      compactTitle: { fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      compactMeta: { fontSize: 10, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      tiny: { border: 'none', background: 'transparent', color: MUTED, fontSize: 11, cursor: 'pointer', padding: '0 2px' },
      weekLabel: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, borderRight: `1px solid ${BORDER}` },
      dow: { fontSize: 11, color: MUTED, textAlign: 'center', padding: '2px 0' },
      cell: { minHeight: 62, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 6px 5px', display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer', boxSizing: 'border-box', overflow: 'hidden' },
      cellWeekend: { background: 'rgba(229,72,77,.05)' },
      cellToday: { borderColor: ACCENT, background: 'rgba(79,110,247,.08)' },
      cellSelected: { boxShadow: `0 0 0 1.5px ${ACCENT} inset` },
      dayNum: { fontSize: 12, color: 'inherit' },
      lunarDay: { fontSize: 10, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      jieQi: { fontSize: 10, color: '#e5484d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      dots: { display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'auto' },
      dot: { width: 6, height: 6, borderRadius: 3, display: 'inline-block' },
      more: { fontSize: 10, color: MUTED },
      almanac: { marginTop: 10, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', maxWidth: 820, display: 'grid', gap: 6 },
      cardsRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, maxWidth: 860 },
      card: { flex: '1 1 320px', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', display: 'grid', gap: 3, boxSizing: 'border-box', minWidth: 0, alignContent: 'start' },
      cardTitle: { fontSize: 12, fontWeight: 600, color: MUTED },
      infoRow: { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, lineHeight: 1.45 },
      infoLabel: { color: MUTED, minWidth: 40 },
      infoValue: { flex: 1, minWidth: 0 },
      zodiacSign: { fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: 8 },
      zodiacElement: { fontSize: 11, color: ACCENT, fontWeight: 500 },
      almanacHead: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
      almanacDate: { fontSize: 13, fontWeight: 600 },
      almanacMeta: { fontSize: 12, color: MUTED },
      yiJi: { display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 12 },
      yiTag: { color: '#30a46c', fontWeight: 600 },
      jiTag: { color: '#e5484d', fontWeight: 600 },
      pengZu: { fontSize: 11, color: MUTED },
      listBar: { display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 8px', maxWidth: 820 },
      separator: { height: 1, background: BORDER, margin: '22px 0 18px', maxWidth: 860 },
      dayPanel: { marginTop: 12, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', maxWidth: 820 },
      dayHead: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 },
      dayTitle: { fontSize: 13, fontWeight: 600 },
      dayItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 13, borderTop: `1px solid ${BORDER}` },
      doneRow: { opacity: 0.5 },
      doneTitle: { textDecoration: 'line-through' },
      toast: { position: 'fixed', right: 24, bottom: 24, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--dsw-surface, #222)', color: 'var(--dsw-text, #fff)', boxShadow: '0 6px 20px rgba(0,0,0,.25)', fontSize: 12, zIndex: 20 },
      search: { padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent', color: 'inherit', fontSize: 12, width: 160 },
      cellCompact: { minHeight: 44, padding: '3px 4px' },
      wrapCompact: { padding: '14px 12px 24px' },
      zone: { padding: '4px 6px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 12 },
      listTitle: { fontSize: 13, fontWeight: 600 },
      colorBar: { width: 3, height: 14, borderRadius: 2, display: 'inline-block', marginRight: 8, verticalAlign: '-2px' },
    }

    function api(action, payload) {
      return fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ action }, payload || {})),
      }).then(function (response) {
        return response.json().catch(function () { return null }).then(function (data) {
          if (!data || !data.ok) {
            const message = (data && data.error && data.error.message) || ('HTTP ' + response.status)
            throw new Error(message)
          }
          return data
        })
      })
    }

    function when(row) {
      if (row.inDays === 0) return '今天'
      if (row.inDays > 0) return row.inDays === 1 ? '明天' : row.inDays + ' 天后'
      return '已过 ' + (-row.inDays) + ' 天'
    }

    function weekLabel(weekNo) {
      return weekNo % 2 === 1 ? '单周' : '双周'
    }

    function kindLabel(kind) {
      for (const entry of KIND_OPTIONS) if (entry[0] === kind) return entry[1]
      return kind
    }

    function emptyForm(today) {
      return {
        title: '', kind: 'anniversary', calendar: 'gregorian', date: today,
        lunarMonth: 1, lunarDay: 1, lunarLeap: false,
        repeat: 'yearly', every: 3, weekdayMask: 0, tags: '', advance: '', remindAt: '',
      }
    }

    function formFromRow(row) {
      return {
        title: row.title, kind: row.kind, calendar: row.calendar,
        date: row.anchor || row.date,
        lunarMonth: row.lunarMonth || 1, lunarDay: row.lunarDay || 1, lunarLeap: row.lunarLeap,
        repeat: row.repeat, every: row.every || 3, weekdayMask: row.weekdayMask || 0,
        tags: (row.tags || []).join(', '),
        advance: (row.advance || []).join(','), remindAt: row.remindAt || '',
      }
    }

    function Field(props) {
      return h('label', { style: styles.field }, [
        h('span', { key: 'label', style: styles.fieldLabel }, props.label),
        props.children,
      ])
    }

    function Form(props) {
      const form = props.form
      const setForm = props.setForm
      const set = (patch) => setForm(Object.assign({}, form, patch))
      const lunar = form.calendar === 'lunar'

      const children = [
        h(Field, { key: 'title', label: '标题' },
          h('input', {
            style: styles.input, value: form.title, autoFocus: true,
            placeholder: '比如：妈妈的生日',
            onChange: (event) => set({ title: event.target.value }),
          })),

        h('div', { key: 'kind', style: styles.row }, [
          h('span', { key: 'l', style: styles.fieldLabel }, '类型'),
          ...KIND_OPTIONS.map((entry) => h('button', {
            key: entry[0],
            type: 'button',
            style: form.kind === entry[0] ? styles.chipOn : styles.chip,
            onClick: () => set({ kind: entry[0], repeat: entry[0] === 'anniversary' ? 'yearly' : form.repeat }),
          }, entry[1])),
        ]),

        h('div', { key: 'calendar', style: styles.row }, [
          h('span', { key: 'l', style: styles.fieldLabel }, '历法'),
          ...['gregorian', 'lunar'].map((value) => h('button', {
            key: value,
            type: 'button',
            style: form.calendar === value ? styles.chipOn : styles.chip,
            onClick: () => set({ calendar: value }),
          }, value === 'lunar' ? '农历' : '公历')),
        ]),
      ]

      if (lunar) {
        const months = Array.from({ length: 12 }, (_, index) => index + 1)
        const days = Array.from({ length: 30 }, (_, index) => index + 1)
        children.push(h('div', { key: 'lunar', style: styles.row }, [
          h('span', { key: 'l', style: styles.fieldLabel }, '农历'),
          h('select', {
            style: styles.input, value: form.lunarMonth,
            onChange: (event) => set({ lunarMonth: Number(event.target.value) }),
          }, months.map((month) => h('option', { key: month, value: month }, month + ' 月'))),
          h('select', {
            style: styles.input, value: form.lunarDay,
            onChange: (event) => set({ lunarDay: Number(event.target.value) }),
          }, days.map((day) => h('option', { key: day, value: day }, day + ' 日'))),
          h('label', { key: 'leap', style: styles.row }, [
            h('input', {
              key: 'c', type: 'checkbox', checked: form.lunarLeap,
              onChange: (event) => set({ lunarLeap: event.target.checked }),
            }),
            h('span', { key: 't', style: styles.fieldLabel }, '闰月'),
          ]),
        ]))
      } else {
        children.push(h('div', { key: 'date', style: styles.row }, [
          h('span', { key: 'l', style: styles.fieldLabel }, '日期'),
          h('input', {
            key: 'd', type: 'date', style: styles.input, value: form.date || '',
            onChange: (event) => set({ date: event.target.value }),
          }),
        ]))
      }

      children.push(h('div', { key: 'repeat', style: styles.row }, [
        h('span', { key: 'l', style: styles.fieldLabel }, '重复'),
        h('select', {
          style: styles.input, value: form.repeat,
          onChange: (event) => set({ repeat: event.target.value }),
        }, REPEAT_OPTIONS.map((entry) => h('option', { key: entry[0], value: entry[0] }, entry[1]))),
        form.repeat === 'customDays'
          ? h('input', {
            key: 'n', type: 'number', min: 2, style: Object.assign({}, styles.input, { width: 70 }),
            value: form.every,
            onChange: (event) => set({ every: Number(event.target.value) }),
          })
          : null,
      ]))

      if (form.repeat === 'weekly') {
        children.push(h('div', { key: 'weekday', style: styles.row }, [
          h('span', { key: 'l', style: styles.fieldLabel }, '每周几'),
          ...WEEKDAYS.map((label, index) => h('button', {
            key: label,
            type: 'button',
            style: (form.weekdayMask >> index) & 1 ? styles.chipOn : styles.chip,
            onClick: () => set({ weekdayMask: form.weekdayMask ^ (1 << index) }),
          }, label)),
        ]))
      }

      children.push(h('div', { key: 'advance', style: styles.row }, [
        h('span', { key: 'l', style: styles.fieldLabel }, '提前提醒'),
        h('input', {
          key: 'n', type: 'text', style: Object.assign({}, styles.input, { width: 90 }),
          placeholder: '7,1',
          value: form.advance, onChange: (event) => set({ advance: event.target.value }),
        }),
        h('span', { key: 'u', style: styles.fieldLabel }, '天前'),
        h('input', {
          key: 't', type: 'time', style: Object.assign({}, styles.input, { width: 110 }),
          value: form.remindAt, title: '提醒时刻，留空用全局设置',
          onChange: (event) => set({ remindAt: event.target.value }),
        }),
        h('span', { key: 'hint', style: styles.fieldLabel }, '（天数可多个；时刻留空用全局）'),
      ]))

      children.push(h('div', { key: 'tags', style: styles.row }, [
        h('span', { key: 'l', style: styles.fieldLabel }, '标签'),
        h('input', {
          style: Object.assign({}, styles.input, { flex: 1 }),
          value: form.tags, placeholder: '逗号分隔，如：家人, 生日',
          onChange: (event) => set({ tags: event.target.value }),
        }),
      ]))

      children.push(h('div', { key: 'actions', style: styles.actions }, [
        h('button', { key: 'cancel', type: 'button', style: styles.button, onClick: props.onCancel }, '取消'),
        h('button', { key: 'save', type: 'button', style: styles.primary, onClick: props.onSubmit },
          props.mode === 'edit' ? '保存' : '添加'),
      ]))

      return h('div', { style: styles.form }, children)
    }

    const GRID_DAYS = ['一', '二', '三', '四', '五', '六', '日']
    const ZONES = ['Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC']

    function CalendarGrid(props) {
      const month = props.month
      if (!month) return h('div', { style: styles.muted }, '加载月历…')

      const lead = typeof month.firstWeekdayMonday === 'number'
        ? month.firstWeekdayMonday
        : (month.firstWeekday + 6) % 7

      const padded = []
      for (let index = 0; index < lead; index += 1) padded.push(null)
      for (const day of month.days) padded.push(day)
      while (padded.length % 7 !== 0) padded.push(null)

      const cells = []
      const headerCells = [h('div', { key: 'dow-empty', style: styles.dow }, '周')]
      for (let index = 0; index < GRID_DAYS.length; index += 1) {
        const label = GRID_DAYS[index]
        headerCells.push(h('div', {
          key: 'dow-' + label,
          style: (index === 5 || index === 6)
            ? Object.assign({}, styles.dow, { color: '#e5484d' })
            : styles.dow,
        }, label))
      }

      for (let row = 0; row * 7 < padded.length; row += 1) {
        const week = padded.slice(row * 7, row * 7 + 7)
        const firstReal = week.find(function (day) { return day !== null })
        const weekNo = firstReal ? (firstReal.weekNo || 1) : 1
        const odd = weekNo % 2 === 1

        cells.push(h('div', {
          key: 'wk-' + row,
          style: Object.assign({}, styles.weekLabel, { color: odd ? '#4f6ef7' : '#8e4ec6' }),
          title: 'ISO 第 ' + weekNo + ' 周',
        }, odd ? '单周' : '双周'))

        for (const day of week) {
          if (day === null) {
            cells.push(h('div', { key: 'blank-' + row + '-' + cells.length }))
            continue
          }
          const date = new Date(day.date + 'T00:00:00Z')
          const weekday = date.getUTCDay()
          const weekend = weekday === 0 || weekday === 6
          const isToday = day.date === month.today
          const isSelected = day.date === props.selected
          const cellStyle = Object.assign({},
            styles.cell,
            props.compact ? styles.cellCompact : {},
            weekend ? styles.cellWeekend : {},
            isToday ? styles.cellToday : {},
            isSelected ? styles.cellSelected : {})

          const marks = day.items.slice(0, 4).map(function (item, index) {
            return h('span', {
              key: index,
              style: Object.assign({}, styles.dot, { background: colorOf(item.id) }),
              title: item.title,
            })
          })

          cells.push(h('div', {
            key: day.date,
            style: cellStyle,
            onClick: function () {
              props.onSelect(day.date === props.selected ? null : day.date)
            },
          }, [
            day.mercuryRetrograde ? h('span', { key: 'rx', style: styles.retroMark, title: '水逆' }, '逆') : null,
            h('div', { key: 'n', style: isToday ? Object.assign({}, styles.dayNum, { color: ACCENT, fontWeight: 700 }) : styles.dayNum }, day.day),
            props.compact
              ? null
              : day.almanac && day.almanac.jieQi
                ? h('div', { key: 'j', style: styles.jieQi }, day.almanac.jieQi)
                : h('div', { key: 'l', style: styles.lunarDay }, day.almanac ? day.almanac.lunarDay : ''),
            h('div', { key: 'd', style: styles.dots }, [
              ...marks,
              day.items.length > 4 ? h('span', { key: 'm', style: styles.more }, '+' + (day.items.length - 4)) : null,
            ]),
          ]))
        }
      }

      return h('div', null, [
        h('div', { key: 'bar', style: styles.calBar }, [
          h('button', { key: 'p', type: 'button', style: styles.button, onClick: props.onPrev }, '‹'),
          h('span', { key: 't', style: styles.calTitle }, month.year + ' 年 ' + month.month + ' 月'),
          h('button', { key: 'n', type: 'button', style: styles.button, onClick: props.onNext }, '›'),
          h('button', { key: 'today', type: 'button', style: styles.button, onClick: props.onToday }, '今天'),
        ]),
        h('div', { key: 'head', style: styles.weekGrid }, headerCells),
        h('div', { key: 'grid', style: props.compact ? Object.assign({}, styles.weekGrid, { maxWidth: '100%' }) : styles.weekGrid }, cells),
      ])
    }

    function Card(props) {
      return h('div', { style: Object.assign({}, styles.card, props.style || {}) }, props.children)
    }

    function InfoRow(props) {
      return h('div', { style: styles.infoRow }, [
        h('span', { key: 'l', style: props.color ? Object.assign({}, styles.infoLabel, { color: props.color }) : styles.infoLabel }, props.label),
        h('span', { key: 'v', style: styles.infoValue }, props.value),
      ])
    }

    function AlmanacCard(props) {
      const [open, setOpen] = React.useState(Boolean(props.defaultOpen))
      const day = props.day
      if (!day || !day.almanac) return null
      const a = day.almanac
      const jiShi = (a.jiShi || []).map(function (slot) { return slot.zhi + ' ' + slot.from })

      return h(Card, null, [
        h('div', { key: 'h', style: styles.cardTitle }, '老黄历'),
        h(InfoRow, { key: 'l', label: '农历', value: a.lunarText + (a.ganzhi ? ' · ' + a.ganzhi : '') }),
        h(InfoRow, { key: 'j', label: '节气', value: a.jieQi || '—' }),
        h(InfoRow, { key: 'z', label: '建除', value: a.zhiXing + '日' }),
        h(InfoRow, { key: 'y', label: '宜', value: a.yi.length ? a.yi.join(' · ') : '—', color: '#30a46c' }),
        h(InfoRow, { key: 'x', label: '忌', value: a.ji.length ? a.ji.join(' · ') : '—', color: '#e5484d' }),
        h(InfoRow, { key: 'c', label: '冲煞', value: (a.chong || '—') + ' · 煞' + (a.sha || '—') }),
        h(InfoRow, { key: 's', label: '值神', value: (a.tianShen || '—') + (a.tianShenType ? ' · ' + a.tianShenType + '日' : '') }),
        h(InfoRow, { key: 'u', label: '星宿', value: (a.xiu || '—') + (a.xiuLuck ? ' · ' + a.xiuLuck : '') }),
        h(InfoRow, { key: 'n', label: '纳音', value: a.naYin || '—' }),
        h(InfoRow, {
          key: 'p', label: '方位',
          value: a.positions ? `喜神 ${a.positions.xi} · 福神 ${a.positions.fu} · 财神 ${a.positions.cai}` : '—',
        }),
        h(InfoRow, { key: 't', label: '吉时', value: jiShi.length ? jiShi.join('、') : '—' }),
        open ? h(InfoRow, { key: 'js', label: '吉神', value: (a.jiShen || []).join(' · ') || '—' }) : null,
        open ? h(InfoRow, { key: 'xs', label: '凶煞', value: (a.xiongSha || []).join(' · ') || '—' }) : null,
        a.pengZu ? h('div', { key: 'pz', style: styles.pengZu }, '彭祖百忌：' + a.pengZu) : null,
        h('button', {
          key: 'toggle', type: 'button',
          style: Object.assign({}, styles.tiny, { justifySelf: 'start' }),
          onClick: function () { setOpen(!open) },
        }, open ? '收起' : '展开'),
      ])
    }

    function ZodiacCard(props) {
      const day = props.day
      if (!day || !day.almanac || !day.almanac.zodiac) return null
      const a = day.almanac
      const z = a.zodiac
      return h(Card, { style: props.grow ? { flex: 1 } : undefined }, [
        h('div', { key: 'h', style: styles.cardTitle }, '星座 · 月相'),
        h('div', { key: 'sign', style: styles.zodiacSign }, [
          z.sign + '座',
          h('span', { key: 'e', style: styles.zodiacElement }, z.element + (z.ruler ? ' · 守护星 ' + z.ruler : '')),
        ]),
        h(InfoRow, { key: 'r', label: '日期', value: day.date + ' 星期' + a.week + (z.range ? ' · ' + z.range : '') }),
        h(InfoRow, { key: 'm', label: '月相', value: a.yueXiang || '—' }),
      ])
    }


    function MercuryStrip(props) {
      const month = props.month
      if (!month) return null
      const today = props.today || month.today
      const ranges = month.retrograde || []
      const current = ranges.find(function (range) { return today >= range.start && today <= range.end })
      const next = ranges.filter(function (range) { return range.start > today }).sort(function (a, b) { return a.start < b.start ? -1 : 1 })[0]

      const gap = function (from, to) {
        return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)
      }

      let status
      if (current) {
        const left = gap(today, current.end)
        status = '水逆中 · ' + current.start + ' → ' + current.end + (left > 0 ? '（还有 ' + left + ' 天）' : '（最后一天）')
      } else if (next) {
        status = '下次 ' + next.start + ' 开始（' + gap(today, next.start) + ' 天后）'
      } else {
        status = '近期没有'
      }

      return h('div', { style: styles.strip }, [
        h('span', { key: 'tag', style: Object.assign({}, styles.stripTag, current ? { color: '#e5484d' } : {}) }, '水星逆行'),
        h('span', { key: 's', style: { fontSize: 12 } }, status),
        ranges.length
          ? h('span', { key: 'r', style: { fontSize: 11, color: MUTED, marginLeft: 'auto' } },
            ranges.map(function (range) { return range.start.slice(5) + '–' + range.end.slice(5) }).join('、'))
          : null,
      ])
    }

    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) { return { error } }
      componentDidCatch(error) { console.error('[dsh-reminder] render failed', error) }
      render() {
        if (this.state.error) {
          return h('div', { style: { padding: 24, fontSize: 13, color: '#e5484d', whiteSpace: 'pre-wrap' } },
            '记日渲染出错：' + String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error))
        }
        return this.props.children
      }
    }

    function PageBoundary(props) {
      return h(Boundary, null, h(Page, props))
    }

    function Page() {
      const [state, setState] = React.useState({ loading: true, rows: [], today: '', error: '' })
      const [month, setMonth] = React.useState(null)
      const [selected, setSelected] = React.useState(null)
      const [editing, setEditing] = React.useState(null)
      const [form, setForm] = React.useState(emptyForm(''))
      const [busy, setBusy] = React.useState(false)
      const [reminder, setReminder] = React.useState({ loading: true, on: false, supported: false })
      const [query, setQuery] = React.useState('')
      const [zone, setZone] = React.useState('')
      const [remindTime, setRemindTime] = React.useState('09:00')
      const [width, setWidth] = React.useState(typeof window === 'undefined' ? 1200 : window.innerWidth)
      const [tag, setTag] = React.useState('')
      const [lastDeleted, setLastDeleted] = React.useState(null)
      const formRef = React.useRef(null)
      const fileRef = React.useRef(null)
      const [listHidden, setListHidden] = React.useState(function () {
        try { return window.localStorage.getItem('dsh-reminder:list-hidden') === '1' } catch (error) { return false }
      })

      function toggleList() {
        setListHidden(function (prev) {
          const next = !prev
          try { window.localStorage.setItem('dsh-reminder:list-hidden', next ? '1' : '0') } catch (error) { /* 忽略 */ }
          return next
        })
      }

      function reportError(error) {
        setState(function (prev) { return Object.assign({}, prev, { error: String(error.message || error) }) })
      }

      const loadAll = React.useCallback(function (year, monthNo) {
        return Promise.all([
          api('list'),
          year && monthNo ? api('month', { year, month: monthNo }) : null,
        ]).then(function (results) {
          const list = results[0]
          const monthData = results[1]
          setState({ loading: false, rows: list.rows || [], today: list.today || '', error: '' })
          if (monthData) setMonth(monthData.month)
          return list
        })
      }, [])

      const loadMonthOnly = React.useCallback(function (year, monthNo) {
        return api('month', { year, month: monthNo }).then(function (data) {
          setMonth(data.month)
          return data
        })
      }, [])

      React.useEffect(function () {
        let alive = true
        const today = new Date()
        loadAll(today.getFullYear(), today.getMonth() + 1)
          .catch(function (error) { if (alive) reportError(error) })
        api('settings.get')
          .then(function (data) {
            if (!alive) return
            if (data.timeZone) setZone(data.timeZone)
            if (data.reminderTime) setRemindTime(data.reminderTime)
          })
          .catch(function () { /* 老版本没有这个路由，忽略 */ })
        const onResize = function () { setWidth(window.innerWidth) }
        window.addEventListener('resize', onResize)
        api('remind.status')
          .then(function (data) {
            if (alive) setReminder({ loading: false, on: Boolean(data.reminder), supported: Boolean(data.supported) })
          })
          .catch(function () { if (alive) setReminder({ loading: false, on: false, supported: false }) })
        return function () {
          alive = false
          window.removeEventListener('resize', onResize)
        }
      }, [loadAll])

      function cursor() {
        const base = state.today || ''
        if (month) return { year: month.year, month: month.month }
        const now = new Date()
        return { year: now.getFullYear(), month: now.getMonth() + 1 }
      }

      function shiftMonth(delta) {
        if (!month) return
        let year = month.year
        let monthNo = month.month + delta
        if (monthNo < 1) { monthNo = 12; year -= 1 }
        if (monthNo > 12) { monthNo = 1; year += 1 }
        loadMonthOnly(year, monthNo).catch(reportError)
      }

      function run(action, payload) {
        setBusy(true)
        api(action, payload)
          .then(function (data) {
            if (action === 'delete' && data.removed) setLastDeleted(data.removed)
            setEditing(null)
            const at = cursor()
            return loadAll(at.year, at.month)
          })
          .catch(reportError)
          .then(function () { setBusy(false) })
      }

      function undoDelete() {
        if (!lastDeleted) return
        api('restore', { item: lastDeleted })
          .then(function () { setLastDeleted(null); return refreshAll() })
          .catch(reportError)
      }

      function toggleDone(row) {
        const action = row.doneNow ? 'undone' : 'done'
        api(action, { id: row.id, occurrence: row.date })
          .then(function () { return refreshAll() })
          .catch(reportError)
      }

      function scrollToForm() {
        setTimeout(function () {
          if (formRef.current && formRef.current.scrollIntoView) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 0)
      }

      function startNew() {
        setForm(emptyForm(state.today))
        setEditing({ mode: 'new', row: null })
        scrollToForm()
      }

      function startEdit(row) {
        setForm(formFromRow(row))
        setEditing({ mode: 'edit', row })
        scrollToForm()
      }

      function refreshAll() {
        const at = cursor()
        return loadAll(at.year, at.month).catch(reportError)
      }

      function downloadText(filename, text, mime) {
        const blob = new Blob([text], { type: mime || 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
      }

      function exportData(format) {
        api('export', { format })
          .then(function (data) { downloadText(data.filename, data.data, data.mime) })
          .catch(reportError)
      }

      function importFile(event) {
        const picked = event.target.files && event.target.files[0]
        event.target.value = ''
        if (!picked) return
        picked.text()
          .then(function (text) { return api('import', { data: text }) })
          .then(function (data) {
            const extra = data.errors && data.errors.length ? `，${data.errors.length} 条有误` : ''
            window.alert(`导入完成：新增 ${data.added} 条，跳过 ${data.skipped} 条${extra}`)
            return refreshAll()
          })
          .catch(reportError)
      }

      function changeZone(next) {
        api('settings.set', { timeZone: next })
          .then(function (data) { setZone(data.timeZone); return refreshAll() })
          .catch(reportError)
      }

      function changeRemindTime(next) {
        setRemindTime(next)
        api('settings.set', { reminderTime: next })
          .then(function (data) {
            if (data.reminder) setReminder({ loading: false, on: true, supported: true })
          })
          .catch(function (error) {
            setRemindTime(remindTime)
            reportError(error)
          })
      }

      function toggleReminder() {
        api(reminder.on ? 'remind.off' : 'remind.on')
          .then(function (data) {
            setReminder({ loading: false, on: Boolean(data.reminder), supported: true })
          })
          .catch(reportError)
      }

      function submit() {
        if (!form.title.trim()) { reportError(new Error('标题不能为空')); return }
        if (!form.date && form.calendar !== 'lunar') { reportError(new Error('请选择日期')); return }
        if (editing.mode === 'new') run('add', { item: form })
        else run('update', { id: editing.row.id, fields: form })
      }

      if (state.loading) return h('div', { style: styles.muted }, '加载中…')

      const dayOf = function (date) {
        if (!month || !date) return null
        return month.days.find(function (day) { return day.date === date }) || null
      }
      const selectedDay = dayOf(selected)
      const todayDay = dayOf(state.today)
      const almanacDay = selectedDay || todayDay
      const allTags = Array.from(new Set(state.rows.reduce(function (acc, row) {
        return acc.concat(row.tags || [])
      }, [])))
      const keyword = query.trim().toLowerCase()
      const listRows = state.rows.filter(function (row) {
        if (tag && (row.tags || []).indexOf(tag) === -1) return false
        if (!keyword) return true
        if (row.title.toLowerCase().indexOf(keyword) !== -1) return true
        return (row.tags || []).some(function (item) { return item.toLowerCase().indexOf(keyword) !== -1 })
      })
      const listTitle = '已录入的事项'
      const compact = width < 780
      const wide = width >= 1080

      const toast = lastDeleted
        ? h('div', { key: 'toast', style: styles.toast }, [
          h('span', { key: 't' }, '已删除「' + lastDeleted.title + '」'),
          h('button', { key: 'u', type: 'button', style: Object.assign({}, styles.linkButton, { color: ACCENT }), onClick: undoDelete }, '撤销'),
          h('button', { key: 'x', type: 'button', style: styles.linkButton, onClick: function () { setLastDeleted(null) } }, '×'),
        ])
        : null

      return h('div', { style: compact ? Object.assign({}, styles.wrap, styles.wrapCompact) : styles.wrap }, [
        h('div', { key: 'header', style: styles.header }, [
          h('h1', { key: 't', style: styles.title }, '记日'),
          h('button', { key: 'add', type: 'button', style: styles.primary, onClick: startNew, disabled: busy }, '+ 新增'),
          selected
            ? h('button', {
              key: 'clear', type: 'button', style: styles.button,
              onClick: function () { setSelected(null) },
            }, '显示全部')
            : null,
          h('span', { key: 's', style: { fontSize: 12, color: MUTED } }, state.today ? '今天 ' + state.today : ''),
          h('span', { key: 'spacer', style: { flex: 1 } }),
          h('select', {
            key: 'zone',
            style: styles.zone,
            value: zone,
            title: '时区：影响「今天」与农历换算',
            onChange: function (event) { changeZone(event.target.value) },
          }, (zone && ZONES.indexOf(zone) === -1 ? [zone] : []).concat(ZONES).map(function (name) {
            return h('option', { key: name, value: name }, name)
          })),
          h('button', { key: 'exp', type: 'button', style: styles.button, onClick: function () { exportData('json') } }, '导出'),
          h('button', { key: 'imp', type: 'button', style: styles.button, onClick: function () { fileRef.current && fileRef.current.click() } }, '导入'),
          h('input', {
            key: 'file', ref: fileRef, type: 'file', accept: '.json,application/json',
            style: { display: 'none' }, onChange: importFile,
          }),
          h('input', {
            key: 'time', type: 'time', value: remindTime, style: styles.zone,
            title: '每日提醒时间',
            onChange: function (event) { changeRemindTime(event.target.value) },
          }),
          h('button', {
            key: 'rem',
            type: 'button',
            style: reminder.on ? styles.chipOn : styles.button,
            title: reminder.supported ? '每天 09:00 在会话里汇报今天与未来 3 天' : '当前 profile 没有 schedule 服务',
            disabled: reminder.loading || !reminder.supported,
            onClick: toggleReminder,
          }, reminder.on ? '每日提醒 已开' : '每日提醒'),
        ]),

        state.error ? h('div', { key: 'error', style: styles.error }, state.error) : null,

        editing
          ? h('div', { key: 'formWrap', ref: formRef },
            h(Form, { form, setForm, onSubmit: submit, onCancel: () => setEditing(null), mode: editing.mode }))
          : null,

        h('div', { key: 'listSection' }, [
          h('div', { key: 'listBar', style: styles.listBar }, [
            h('span', { key: 't', style: styles.listTitle }, listTitle),
            h('span', { key: 'c', style: { fontSize: 12, color: MUTED } }, listRows.length ? listRows.length + ' 条' : ''),
            h('input', {
              key: 'q', style: styles.search, value: query, placeholder: '搜索标题 / 标签',
              onChange: function (event) { setQuery(event.target.value) },
            }),
            h('button', {
              key: 'toggle',
              type: 'button',
              style: Object.assign({}, styles.linkButton, { marginLeft: 'auto' }),
              title: listHidden ? '展开列表' : '收起列表',
              onClick: toggleList,
            }, listHidden ? '显示' : '隐藏'),
          ]),

          allTags.length
            ? h('div', { key: 'tags', style: Object.assign({}, styles.row, { margin: '0 0 8px', flexWrap: 'wrap' }) }, [
              h('button', { key: 'all', type: 'button', style: tag ? styles.chip : styles.chipOn, onClick: function () { setTag('') } }, '全部'),
              ...allTags.map(function (name) {
                return h('button', {
                  key: name, type: 'button', style: tag === name ? styles.chipOn : styles.chip,
                  onClick: function () { setTag(tag === name ? '' : name) },
                }, name)
              }),
            ])
            : null,

          listHidden
            ? null
            : listRows.length === 0
            ? h('div', { key: 'empty', style: styles.muted }, '还没有记录。点「+ 新增」，或者在对话里说一句。')
            : h('table', { key: 'table', style: styles.table }, [
              h('thead', { key: 'head' }, h('tr', null, [
                h('th', { key: 'w', style: styles.th }, '单双周'),
                h('th', { key: 'd', style: styles.th }, '日期'),
                compact ? null : h('th', { key: 'i', style: styles.th }, '距今'),
                h('th', { key: 't', style: styles.th }, '事项'),
                h('th', { key: 'a', style: Object.assign({}, styles.th, { textAlign: 'right' }) }, ''),
              ])),
              h('tbody', { key: 'body' }, listRows.map(function (row) {
                const tone = row.overdue ? styles.overdue : row.inDays <= 3 ? styles.soon : undefined
                return h('tr', { key: row.id, style: row.doneNow ? styles.doneRow : undefined }, [
                  h('td', { key: 'w', style: Object.assign({}, styles.td, { color: MUTED, fontSize: 12 }) }, weekLabel(row.weekNo || 1)),
                  h('td', { key: 'd', style: Object.assign({}, styles.td, tone || {}) }, row.date),
                  compact ? null : h('td', { key: 'i', style: Object.assign({}, styles.td, tone || {}) }, when(row)),
                  h('td', { key: 't', style: styles.td }, [
                    h('span', { key: 'c', style: Object.assign({}, styles.colorBar, { background: colorOf(row.id) }) }),
                    h('span', { key: 'tt', style: row.doneNow ? styles.doneTitle : undefined }, row.title),
                    row.lunar ? h('span', { key: 'l', style: styles.badge }, row.lunar) : null,
                    row.repeat !== 'none' ? h('span', { key: 'r', style: styles.badge }, kindLabel(row.kind)) : null,
                    (row.advance || []).length ? h('span', { key: 'a', style: styles.badge }, '提前' + row.advance.join('/') + '天' + (row.remindAt ? ' · ' + row.remindAt : '')) : null,
                    (row.tags || []).map(function (tag) {
                      return h('span', { key: 'tag-' + tag, style: styles.badge }, tag)
                    }),
                  ]),
                  h('td', { key: 'a', style: Object.assign({}, styles.td, styles.actions) }, [
                    h('button', {
                      key: 'done', type: 'button', style: styles.linkButton, disabled: busy,
                      onClick: function () { toggleDone(row) },
                    }, row.doneNow ? '撤销' : (row.today ? '完成' : '打卡')),
                    h('button', {
                      key: 'edit', type: 'button', style: styles.linkButton,
                      onClick: function () { startEdit(row) },
                    }, '编辑'),
                    h('button', {
                      key: 'del', type: 'button', style: Object.assign({}, styles.linkButton, { color: DANGER }),
                      onClick: function () {
                        if (window.confirm('删除「' + row.title + '」？')) run('delete', { id: row.id })
                      },
                    }, '删除'),
                  ]),
                ])
              })),
            ]),
        ]),

          h('div', { key: 'sep', style: styles.separator }),

          h('div', { key: 'calRow', style: styles.calRow }, [
            h('div', { key: 'calCol', style: styles.calCol }, [
              h(MercuryStrip, { key: 'mercury', month, today: state.today }),
              h(CalendarGrid, {
                key: 'cal',
                month,
                compact,
                selected,
                onSelect: setSelected,
                onPrev: () => shiftMonth(-1),
                onNext: () => shiftMonth(1),
                onToday: () => {
                  const now = new Date()
                  const iso = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
                  setSelected(iso)
                  loadMonthOnly(now.getFullYear(), now.getMonth() + 1).catch(reportError)
                },
              }),
            ]),
            h('div', { key: 'sideCol', style: styles.sideCol }, [
              h(AlmanacCard, { key: 'almanac', day: almanacDay }),
              h(ZodiacCard, { key: 'zodiac', day: almanacDay, grow: true }),
            ]),
          ]),


          selectedDay
            ? h('div', { key: 'day', style: styles.dayPanel }, [
              h('div', { key: 'h', style: styles.dayHead }, [
                h('span', { key: 't', style: styles.dayTitle }, selected + ' 的安排'),
                h('span', { key: 'c', style: { fontSize: 12, color: MUTED } }, selectedDay.items.length + ' 条'),
                h('button', {
                  key: 'x', type: 'button', style: Object.assign({}, styles.linkButton, { marginLeft: 'auto' }),
                  onClick: function () { setSelected(null) },
                }, '关闭'),
              ]),
              selectedDay.items.length === 0
                ? h('div', { key: 'e', style: { fontSize: 12, color: MUTED, padding: '4px 0' } }, '这天没有安排。')
                : selectedDay.items.map(function (row) {
                  return h('div', { key: row.id, style: styles.dayItem }, [
                    h('span', { key: 'c', style: Object.assign({}, styles.colorBar, { background: colorOf(row.id) }) }),
                    h('span', { key: 't', style: { flex: 1 } }, row.title),
                    row.lunar ? h('span', { key: 'l', style: styles.badge }, row.lunar) : null,
                    row.repeat !== 'none' ? h('span', { key: 'r', style: styles.badge }, kindLabel(row.kind)) : null,
                    (row.advance || []).length ? h('span', { key: 'a', style: styles.badge }, '提前' + row.advance.join('/') + '天' + (row.remindAt ? ' · ' + row.remindAt : '')) : null,
                    h('button', {
                      key: 'e', type: 'button', style: styles.linkButton,
                      onClick: function () { startEdit(row) },
                    }, '编辑'),
                    h('button', {
                      key: 'd', type: 'button', style: Object.assign({}, styles.linkButton, { color: DANGER }),
                      onClick: function () {
                        if (window.confirm('删除「' + row.title + '」？')) run('delete', { id: row.id })
                      },
                    }, '删除'),
                  ])
                }),
            ])
            : null,

        toast,
      ])
    }

    function CalendarIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
      }, [
        h('rect', { key: 'r', x: 3, y: 5, width: 18, height: 16, rx: 2 }),
        h('path', { key: 'l1', d: 'M3 10h18' }),
        h('path', { key: 'l2', d: 'M8 3v4M16 3v4' }),
      ])
    }

    module.exports = {
      name: 'dsh-reminder',
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-reminder' }, PageBoundary))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'dsh-reminder',
          order: 60,
          label: () => '记日',
        }, CalendarIcon))
      },
    }

    if (globalThis.__DSH_JIRI_TEST__) {
      module.exports.__test = { Page, Form, CalendarGrid, AlmanacCard, ZodiacCard, MercuryStrip, colorOf, when, weekLabel }
    }

    return module.exports
  },
})
