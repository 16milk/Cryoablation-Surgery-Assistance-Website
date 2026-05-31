import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

/**
 * Width of each series-table column. Uses CSS grid track sizes (inline, so they
 * are not subject to Tailwind's static class purging — the previous
 * `w-1/${n}` approach silently lost its width when the column count changed).
 * `minmax(0, …)` lets cells truncate instead of forcing the row wider.
 */
const columnTrack = (key: string): string => {
  if (key === 'actions') {
    return 'minmax(72px, max-content)';
  }
  if (key === 'description') {
    return 'minmax(0, 3fr)';
  }
  return 'minmax(0, 1fr)';
};

const StudyListExpandedRow = ({ seriesTableColumns, seriesTableDataSource, children }) => {
  const columnKeys = Object.keys(seriesTableColumns);
  const gridTemplateColumns = columnKeys.map(columnTrack).join(' ');

  return (
    <div className="bg-black w-full py-4 pl-12 pr-2">
      <div className="block">{children}</div>

      <div className="border-secondary-light mt-4 overflow-hidden rounded border">
        {/* Header */}
        <div
          className="bg-secondary-dark text-secondary-light grid items-center text-sm font-semibold"
          style={{ gridTemplateColumns }}
        >
          {columnKeys.map(columnKey => (
            <div
              key={columnKey}
              className="truncate px-3 py-2"
            >
              {seriesTableColumns[columnKey]}
            </div>
          ))}
        </div>

        {/* Body — iterate by column key (not row key) so cells always align. */}
        {seriesTableDataSource.length === 0 ? (
          <div className="text-secondary-light px-3 py-3 text-sm">—</div>
        ) : (
          seriesTableDataSource.map((row, i) => (
            <div
              key={i}
              className="border-secondary-light hover:bg-secondary-dark/60 grid items-center border-t text-sm text-white transition-colors"
              style={{ gridTemplateColumns }}
            >
              {columnKeys.map(columnKey => {
                const content = row[columnKey];
                const isText = typeof content === 'string' || typeof content === 'number';
                return (
                  <div
                    key={columnKey}
                    className={classnames(
                      'px-3 py-2',
                      columnKey === 'actions'
                        ? 'flex items-center justify-start'
                        : isText
                          ? 'truncate'
                          : ''
                    )}
                    title={isText ? String(content) : undefined}
                  >
                    {content ?? ''}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

StudyListExpandedRow.propTypes = {
  seriesTableDataSource: PropTypes.arrayOf(PropTypes.object).isRequired,
  seriesTableColumns: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
};

export default StudyListExpandedRow;
