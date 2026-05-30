import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import LegacyButton from '../LegacyButton';
import Typography from '../Typography';
import InputGroup from '../InputGroup';
import { Icons } from '@ohif/ui-next';

const StudyListFilter = ({
  filtersMeta,
  filterValues,
  onChange,
  clearFilters,
  isFiltering,
  numOfStudies,
  onUploadClick,
  getDataSourceConfigurationComponent,
}) => {
  const { t } = useTranslation('StudyList');
  const { sortBy, sortDirection } = filterValues;
  const filterSorting = { sortBy, sortDirection };
  const setFilterSorting = sortingValues => {
    onChange({
      ...filterValues,
      ...sortingValues,
    });
  };
  const isSortingEnabled = numOfStudies > 0 && numOfStudies <= 100;

  return (
    <React.Fragment>
      <div>
        <div className="bg-bkg-med">
          <div className="container relative mx-auto flex flex-col px-4 pt-6 pb-2">
            <div className="mb-4 flex flex-row items-center justify-between">
              <div className="flex min-w-[1px] shrink flex-row items-center gap-5">
                <Typography
                  variant="h6"
                  className="text-common-main text-xl font-semibold tracking-tight"
                >
                  {t('StudyList')}
                </Typography>
                {getDataSourceConfigurationComponent && getDataSourceConfigurationComponent()}
                {onUploadClick && (
                  <button
                    type="button"
                    className="bg-actions-primary hover:bg-customgreen-200 flex cursor-pointer items-center gap-2 self-center rounded-lg px-5 py-2.5 text-base font-semibold text-white shadow-md transition-colors duration-200"
                    onClick={onUploadClick}
                    data-cy="add-data-button"
                  >
                    <Icons.Upload className="h-5 w-5" />
                    <span>{t('AddData')}</span>
                  </button>
                )}
              </div>
              <div className="flex h-[34px] flex-row items-center">
                {isFiltering && (
                  <LegacyButton
                    rounded="full"
                    variant="outlined"
                    color="primaryActive"
                    border="primaryActive"
                    className="mx-8"
                    startIcon={<Icons.Cancel />}
                    onClick={clearFilters}
                  >
                    {t('ClearFilters')}
                  </LegacyButton>
                )}

                <Typography
                  variant="h6"
                  className="text-common-main mr-2"
                  data-cy={'num-studies'}
                >
                  {numOfStudies > 100 ? '>100' : numOfStudies}
                </Typography>
                <Typography
                  variant="h6"
                  className="text-primary-light"
                >
                  {`${t('Studies')} `}
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-bkg-full sticky -top-1 z-10 mx-auto border-b-4">
        <div className="bg-secondary-dark pt-3 pb-3">
          <InputGroup
            inputMeta={filtersMeta}
            values={filterValues}
            onValuesChange={onChange}
            sorting={filterSorting}
            onSortingChange={setFilterSorting}
            isSortingEnabled={isSortingEnabled}
          />
        </div>
        {numOfStudies > 100 && (
          <div className="container m-auto">
            <div className="bg-primary-main rounded-b py-1 text-center text-base">
              <p className="text-white">
                {t('Filter list to 100 studies or less to enable sorting')}
              </p>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

StudyListFilter.propTypes = {
  filtersMeta: PropTypes.arrayOf(
    PropTypes.shape({
      /** Identifier used to map a field to it's value in `filterValues` */
      name: PropTypes.string.isRequired,
      /** Friendly label for filter field */
      displayName: PropTypes.string.isRequired,
      /** One of the supported filter field input types */
      inputType: PropTypes.oneOf(['Text', 'MultiSelect', 'DateRange', 'None']).isRequired,
      isSortable: PropTypes.bool.isRequired,
      /** Size of filter field in a 12-grid system */
      gridCol: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).isRequired,
      /** Options for a "MultiSelect" inputType */
      option: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.string,
        })
      ),
    })
  ).isRequired,
  filterValues: PropTypes.object.isRequired,
  numOfStudies: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  clearFilters: PropTypes.func.isRequired,
  isFiltering: PropTypes.bool.isRequired,
  onUploadClick: PropTypes.func,
  getDataSourceConfigurationComponent: PropTypes.func,
};

export default StudyListFilter;
