/**
 * Overlays interactive inputs on top of a page's form-field widgets. The
 * container ignores pointer events; only the inputs capture them, and only when
 * the Select tool is active — so drawing tools can still annotate over a field.
 */
export function FormFieldLayer({ fields, values, onChange, interactive, width, height }) {
  if (!fields || fields.length === 0) return null

  const pe = interactive ? 'auto' : 'none'

  return (
    <div className="pointer-events-none absolute inset-0" style={{ width, height }}>
      {fields.map((f) => {
        const style = {
          position: 'absolute',
          left: f.rect.x * width,
          top: f.rect.y * height,
          width: f.rect.w * width,
          height: f.rect.h * height,
          pointerEvents: f.readOnly ? 'none' : pe
        }
        const base =
          'rounded-[2px] border border-accent/60 bg-accent/5 outline-none focus:border-accent focus:bg-white'

        // Checkbox
        if (f.fieldType === 'Btn' && f.checkBox) {
          const checked = values[f.name] !== undefined ? !!values[f.name] : f.fieldValue && f.fieldValue !== 'Off'
          return (
            <input
              key={f.id}
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(f.name, e.target.checked)}
              style={style}
              className="cursor-pointer accent-[hsl(var(--accent))]"
            />
          )
        }

        // Radio button (one widget per option; grouped by field name)
        if (f.fieldType === 'Btn' && f.radioButton) {
          const current = values[f.name] !== undefined ? values[f.name] : f.fieldValue
          return (
            <input
              key={f.id}
              type="radio"
              name={f.name}
              checked={current === f.exportValue}
              onChange={() => onChange(f.name, f.exportValue)}
              style={style}
              className="cursor-pointer accent-[hsl(var(--accent))]"
            />
          )
        }

        // Dropdown / choice
        if (f.fieldType === 'Ch' && f.options) {
          const val = values[f.name] !== undefined ? values[f.name] : f.fieldValue ?? ''
          return (
            <select
              key={f.id}
              value={val}
              onChange={(e) => onChange(f.name, e.target.value)}
              style={{ ...style, fontSize: Math.max(9, f.rect.h * height * 0.55) }}
              className={base + ' px-1'}
            >
              <option value="" />
              {f.options.map((o) => (
                <option key={o.exportValue} value={o.exportValue}>
                  {o.displayValue}
                </option>
              ))}
            </select>
          )
        }

        // Text field (single or multi-line)
        const val = values[f.name] !== undefined ? values[f.name] : f.fieldValue ?? ''
        const fontSize = Math.max(9, f.rect.h * height * (f.multiline ? 0.28 : 0.6))
        const common = {
          key: f.id,
          value: val,
          onChange: (e) => onChange(f.name, e.target.value),
          style: { ...style, fontSize },
          className: base + ' px-1'
        }
        return f.multiline ? (
          <textarea {...common} className={common.className + ' resize-none py-0.5'} />
        ) : (
          <input type="text" {...common} />
        )
      })}
    </div>
  )
}
