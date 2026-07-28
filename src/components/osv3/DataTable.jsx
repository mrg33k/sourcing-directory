import React from 'react'

/**
 * DataTable — the admin "Recent Organizations" table.
 *
 * columns: [{ id, header, align? }]
 * rows:    [{ id, cells: { <columnId>: node } }]
 *
 * The table stays a real <table> (header cells, scope, one row per record) and
 * scrolls inside its own container rather than pushing the page sideways.
 */

export default function DataTable({ columns = [], rows = [], caption }) {
  return (
    <div className="osv3p-table-scroll">
      <table className="osv3p-table">
        {caption ? <caption className="osv3p-card-title">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.id} scope="col" className={c.align === 'right' ? 'osv3p-table-actions' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.id} className={c.align === 'right' ? 'osv3p-table-actions' : undefined}>
                  {r.cells[c.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
