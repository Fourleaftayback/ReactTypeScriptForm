import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import _ from 'lodash';
import { ActionStateReducerWithFields } from '../../../helpers/interfaces/ActionStateReducer';
import toast from '../../../helpers/vendors/toast';
import {
  getPatientData,
  getPatientInsuranceInfo,
} from '../../../helpers/requests/patient-data';
import { getAvailableDeviceFromFacilityId } from '../../../helpers/requests/device-data';
import FilledTextInputField from '../../common/fields/FilledTextInputField';
import SelectFilledInputField from '../../common/fields/SelectFilledInputField';
import PrimaryButton from '../../common/buttons/PrimaryButton';
import {
  selectItemsForCountries,
  listOfStatesUnderSelectedCountry,
} from '../../../helpers/misc/countries';
import CheckboxInputField from '../../common/fields/CheckboxInputField';
import { devLogger } from '../../../helpers/misc/dev-logger';
import { getUserToken } from '../../../helpers/firebase/utils';
import api from '../../../helpers/vendors/api';
import { Props, LocalState } from './interfaces';
import { convertEmptyToNull } from '../../../helpers/misc/transform-string';
import { useSelector } from 'react-redux';
import { getPhysiciansByAccountId } from '../../../helpers/requests/user-data';
import { useHistory, useLocation } from 'react-router-dom';
import { registerGAEvents } from '../../../helpers/vendors/google-analytics';
import { validatePhoneNumber } from '../../../helpers/misc/validation';
import { Permissions } from '../../../helpers/enums/Permissions';
import {
  getHeightCM,
  getHeightCMToFootAndInches,
} from '../../../helpers/misc/unit-of-measurements';
import { getDeviceLanguages } from '../../../helpers/requests/globals';
import { useEffectOnce } from 'react-use';
import DeviceAutoCompleteInputField from '../../common/fields/DeviceAutoCompleteInputField';
import { format } from 'date-fns';

const initState: LocalState = {
  patientData: {},
  physicianDataList: [],
  isLoading: false,
  prevPrimaryPhysicianID: '',
  availableDevicesList: [],
  languageSelectItems: [],
  previousDeviceId: null,
  patientAccountId: null,
};

enum DispatchSetter {
  SET_PATIENT_DATA,
  SET_LOADER_ON,
  SET_LOADER_OFF,
  SET_PHYSICIAN_LIST,
  SET_PREV_PRIMARY_PHYSICIAN_ID,
  SET_DEVICE_LIST,
  SET_LANGUAGE_SELECT_ITEMS,
  SET_PREV_DEVICE_ID,
  SET_PATIENT_ACCOUNT_ID,
}

const reducer = (state: LocalState, action: ActionStateReducerWithFields): LocalState => {
  switch (action.type) {
    case DispatchSetter.SET_LOADER_ON:
      return { ...state, isLoading: true };
    case DispatchSetter.SET_LOADER_OFF:
      return { ...state, isLoading: false };
    case DispatchSetter.SET_PATIENT_DATA:
      return { ...state, patientData: action.objInput || {} };
    case DispatchSetter.SET_PHYSICIAN_LIST: {
      return { ...state, physicianDataList: action.listInput || [] };
    }
    case DispatchSetter.SET_DEVICE_LIST: {
      return { ...state, availableDevicesList: action.listInput || [] };
    }
    case DispatchSetter.SET_LANGUAGE_SELECT_ITEMS: {
      return { ...state, languageSelectItems: action.listInput || [] };
    }
    case DispatchSetter.SET_PREV_PRIMARY_PHYSICIAN_ID:
      return { ...state, prevPrimaryPhysicianID: action.stringInput || '' };
    case DispatchSetter.SET_PREV_DEVICE_ID:
      return { ...state, previousDeviceId: action.stringInput || null };
    case DispatchSetter.SET_PATIENT_ACCOUNT_ID:
      return { ...state, patientAccountId: action.stringInput || null };
    default:
      return { ...state };
  }
};

const PatientInfoForm: React.FC<Props> = props => {
  const { avalFacilities } = useSelector(store => {
    return {
      avalFacilities: Object.keys(_.get(store, 'listDataState.facilityListData') || []),
    };
  });
  const { permissions } = useSelector(store => ({
    permissions: _.get(store, 'currentUserState.permissions') || [],
  }));

  const [state, dispatch] = useReducer(reducer, initState);
  const { push } = useHistory();
  const { pathname } = useLocation();

  useEffectOnce(() => {
    (async () => {
      const languageData = await getDeviceLanguages();
      const languageSelectTItems = languageData.map((item: object, indx: number) => {
        const abbv = _.get(item, 'abbreviation') || '';

        return {
          displayName: _.get(item, 'displayName'),
          data: abbv,
          key: `${abbv}-${indx}`,
        };
      });

      dispatch({
        type: DispatchSetter.SET_LANGUAGE_SELECT_ITEMS,
        listInput: languageSelectTItems,
      });
    })();
  });

  useEffect(() => {
    const { patientId, facilityId } = props;

    if (patientId && facilityId) {
      (async (): Promise<void> => {
        dispatch({ type: DispatchSetter.SET_LOADER_ON });

        const patientData = await getPatientData(facilityId, patientId);
        const patientInsuranceData = await getPatientInsuranceInfo(patientId);
        const items = await getAvailableDeviceFromFacilityId(props.facilityId);
        const utcDate = new Date(
          _.get(patientData, 'dateOfBirth.seconds') * 1000,
        ).toUTCString();
        const offset = new Date(utcDate).getTimezoneOffset() * 60 * 1000;

        const patientFormData = {
          ...patientData,
          firstName: _.get(patientData, 'firstName') || '',
          lastName: _.get(patientData, 'lastName') || '',
          middleName: _.get(patientData, 'middleName') || '',
          address1: _.get(patientData, 'address.address1') || '',
          address2: _.get(patientData, 'address.address2') || '',
          city: _.get(patientData, 'address.city') || '',
          country: _.get(patientData, 'address.country') || '',
          state: _.get(patientData, 'address.state') || '',
          zip: _.get(patientData, 'address.zip') || '',
          phoneNumber: String(_.get(patientData, 'phoneNumber') || '')
            .replace(/^\+/, '')
            .trim(),
          dateOfBirth: _.get(patientData, 'dateOfBirth.seconds')
            ? format(new Date(_.get(patientData, 'dateOfBirth.seconds') * 1000 + offset), 'P')
            : '',
          gender: _.get(patientData, 'gender') || 'male',
          emergencyFirstName: _.get(patientData, 'emergencyContact.firstName') || '',
          emergencyLastName: _.get(patientData, 'emergencyContact.lastName') || '',
          emergencyPhone: String(_.get(patientData, 'emergencyContact.phoneNumber') || '')
            .replace(/^\+/, '')
            .trim(),
          emergencyRelation: _.get(patientData, 'emergencyContact.relation') || '',
          deviceLanguage: _.get(patientData, 'deviceLanguage') || 'en',
          isTCM: _.get(patientData, 'tcm') || false,
          subscriber: _.get(patientInsuranceData, 'subscriber') || '',
          groupNumber: _.get(patientInsuranceData, 'groupNumber') || '',
          policyNumber: _.get(patientInsuranceData, 'policyNumber') || '',
          primaryPhysicianID: _.get(patientData, 'primaryPhysicianID') || '',
          secondaryId: _.get(patientData, 'secondaryID') || '',
          deviceId: _.get(patientData, 'deviceID') || '',
          email: _.get(patientData, 'email') || '',
          planOfCare: _.get(patientData, 'planOfCare') || '',
          diagnosis: _.get(patientData, 'diagnosis') || '',
          weight: _.get(patientData, 'weight') || '',
          heightFoot: getHeightCMToFootAndInches(_.get(patientData, 'height') || 0).foot,
          heightInches: getHeightCMToFootAndInches(_.get(patientData, 'height') || 0).inches,
          patientGroupID: _.get(patientData, 'patientGroupID') || null,
        };

        dispatch({
          type: DispatchSetter.SET_PREV_DEVICE_ID,
          stringInput: _.get(patientData, 'deviceID') || null,
        });

        const transformDeviceList = !_.get(patientData, 'deviceID')
          ? items.map((item, index) => ({
              displayName: _.get(item, 'deviceID'),
              data: _.get(item, 'deviceID'),
              key: `${_.get(item, 'deviceID')}-device-${index}`,
            }))
          : [
              ...items.map((item, index) => ({
                displayName: _.get(item, 'deviceID'),
                data: _.get(item, 'deviceID'),
                key: `${_.get(item, 'deviceID')}-device-${index}`,
              })),
              {
                displayName: _.get(patientData, 'deviceID'),
                data: _.get(patientData, 'deviceID'),
                key: `${_.get(patientData, 'deviceID')}-existing-data`,
              },
            ];

        dispatch({
          type: DispatchSetter.SET_PREV_PRIMARY_PHYSICIAN_ID,
          stringInput: _.get(patientData, 'primaryPhysicianID'),
        });
        dispatch({ type: DispatchSetter.SET_PATIENT_DATA, objInput: patientFormData });
        dispatch({
          type: DispatchSetter.SET_DEVICE_LIST,
          listInput: transformDeviceList,
        });
        dispatch({
          type: DispatchSetter.SET_PATIENT_ACCOUNT_ID,
          stringInput: _.get(patientData, 'accountID') || null,
        });

        dispatch({ type: DispatchSetter.SET_LOADER_OFF });
      })();
    } else {
      toast.warn(`Patient ID or facility ID is missing`);
    }
  }, [props]);

  useEffect(() => {
    if (_.isNull(state.patientAccountId)) return;
    if (_.isEmpty(props.facilityId)) return;

    (async (): Promise<void> => {
      devLogger('Grabbed provider list', 'useEffect() - PatientInfoForm');

      const physicianList = await getPhysiciansByAccountId(state.patientAccountId || '');
      const filteredPhysicians = (physicianList || []).filter(physData => {
        if (
          _.isNull(_.get(physData, 'facilities')) ||
          _.isUndefined(_.get(physData, 'facilities'))
        )
          return physData;

        return (_.get(physData, 'facilities') || []).includes(props.facilityId);
      });
      dispatch({ type: DispatchSetter.SET_PHYSICIAN_LIST, listInput: filteredPhysicians });
    })();
  }, [state.patientAccountId, props.facilityId]);

  const filteredPhysicianItems = useMemo(() => {
    return state.physicianDataList.filter(item => {
      if (_.isNull(avalFacilities)) return item;
      if (!_.get(item, 'facilities')) return item;

      return (_.get(item, 'facilities') || []).some((listItem: string) => {
        return avalFacilities.includes(listItem);
      });
    });

    // eslint-disable-next-line
  }, [state.physicianDataList]);

  const handleInput = useCallback(
    (value: string, field: string): void => {
      dispatch({
        type: DispatchSetter.SET_PATIENT_DATA,
        objInput: { ...state.patientData, [field]: value },
      });
    },
    [state.patientData],
  );

  const handleNonTextInputField = useCallback(
    (field: string) => (value: string | Date | null | boolean): void => {
      dispatch({
        type: DispatchSetter.SET_PATIENT_DATA,
        objInput: { ...state.patientData, [field]: value },
      });
    },
    [state.patientData],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<{}>): Promise<void | React.ReactText> => {
      e.preventDefault();

      if (Number(state.patientData?.heightInches || 0) > 11) {
        return toast.warn(`Height is invalid`);
      }

      if (
        !validatePhoneNumber(
          _.get(state.patientData, 'country') || '',
          _.get(state.patientData, 'phoneNumber') || '',
        )
      )
        return toast.warn(`The phone number is not valid.`);

      const patientId = _.get(props, 'patientId') || '';
      const body = {
        firstName: (state.patientData.firstName || '').trim(),
        middleName: (state.patientData.middleName || '').trim(),
        lastName: (state.patientData.lastName || '').trim(),
        dateOfBirth: (state.patientData.dateOfBirth || '').trim(),
        gender: state.patientData.gender,
        phoneNumber: String(state.patientData.phoneNumber).replace(/\D/g, ''),
        email: (state.patientData?.email || '').trim(),
        address: {
          address1: (state.patientData.address1 || '').trim(),
          address2: (state.patientData.address2 || '').trim(),
          city: (state.patientData.city || '').trim(),
          state: (state.patientData.state || '').trim(),
          country: (state.patientData.country || '').trim(),
          zip: (state.patientData.zip || '').trim(),
        },
        emergencyContact: {
          firstName: (state.patientData.emergencyFirstName || '').trim(),
          lastName: (state.patientData.emergencyLastName || '').trim(),
          relation: (state.patientData.emergencyRelation || '').trim(),
          phoneNumber: String(state.patientData.emergencyPhone).replace(/\D/g, ''),
        },
        deviceLanguage: state.patientData.deviceLanguage,
        tcm: state.patientData.isTCM,
        insurance: {
          subscriber: convertEmptyToNull(String(state.patientData.subscriber || '').trim()),
          groupNumber: convertEmptyToNull(String(state.patientData.groupNumber || '').trim()),
          policyNumber: convertEmptyToNull(
            String(state.patientData.policyNumber || '').trim(),
          ),
        },
        primaryPhysicianID: convertEmptyToNull(
          String(state.patientData.primaryPhysicianID || '').trim(),
        ),
        secondaryID: convertEmptyToNull(String(state.patientData.secondaryId || '').trim()),
        deviceID: convertEmptyToNull(_.get(state.patientData, 'deviceId') || ''),
        planOfCare: convertEmptyToNull(String(state.patientData.planOfCare || '').trim()),
        diagnosis: convertEmptyToNull(String(state.patientData.diagnosis || '').trim()),
        weight: !convertEmptyToNull(state.patientData.weight || '')
          ? null
          : Number(convertEmptyToNull(state.patientData.weight || '')),
        height: !getHeightCM({
          foot: state.patientData?.heightFoot || '',
          inches: state.patientData?.heightInches || '',
        })
          ? null
          : Number(
              getHeightCM({
                foot: state.patientData?.heightFoot || '',
                inches: state.patientData?.heightInches || '',
              }),
            ),
      };

      if (state.previousDeviceId === body.deviceID) {
        delete body.deviceID;
      }
      if (body.deviceID === 'no device') {
        body.deviceID = null;
      }

      try {
        dispatch({ type: DispatchSetter.SET_LOADER_ON });
        const token = await getUserToken();

        await api.put(`/patient/${patientId}`, body, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        registerGAEvents({
          category: 'UPDATE',
          action: 'modify patient',
          label: 'Patient pages',
        });
        if (props.closeModal) {
          await props.closeModal();
        }
        if (state.patientData.primaryPhysicianID !== state.prevPrimaryPhysicianID) {
          push(`/`);
        } else {
          if (pathname === '/patient-page') {
            push(
              `/patient-page?facilityId=${_.get(
                state.patientData,
                'facilityID',
              )}&userId=${patientId}&deviceId=${
                _.isNull(body.deviceID) ? 'no-device-id' : body.deviceID
              }`,
            );
          }
        }
        toast.success(
          `Successfully updated ${state.patientData.firstName} ${state.patientData.lastName}`,
        );
      } catch ({ response }) {
        devLogger(response, 'handleSubmit() - PatientInfoForm component');
        toast.error(
          _.get(response, 'data.responseMessage') ||
            'Server Error: Failed to update patient information',
        );
      } finally {
        dispatch({ type: DispatchSetter.SET_LOADER_OFF });
      }
    },
    [
      props,
      state.patientData,
      state.prevPrimaryPhysicianID,
      push,
      state.previousDeviceId,
      pathname,
    ],
  );

  const shouldDisableDeviceIdFieldSelector = useMemo(() => {
    if (_.isEmpty(state.patientData)) return false;
    if (_.isEmpty(props.patientId)) return false;

    return (
      _.get(state.patientData, 'patientGroupID') &&
      _.get(state.patientData, 'patientGroupID') !== props.patientId
    );
  }, [state.patientData, props.patientId]);

  const handleDeviceSelection = useCallback(
    val => {
      dispatch({
        type: DispatchSetter.SET_PATIENT_DATA,
        objInput: { ...state.patientData, deviceId: val },
      });
    },
    [dispatch, state.patientData],
  );

  return (
    <form onSubmit={handleSubmit} className="general-form">
      <div className="general-form__content">
        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell large-5 auto general-form-helper--add-margin-bottom-1 general-form-helper--add-margin-top-1">
            <CheckboxInputField
              value={state.patientData.isTCM || false}
              setter={handleNonTextInputField('isTCM')}
              label="TCM Patient"
            />
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <SelectFilledInputField
              isRequired
              margin="dense"
              label="Primary Physician"
              items={filteredPhysicianItems.map((listItem: object) => ({
                displayName: `${_.get(listItem, 'firstName')} ${_.get(listItem, 'lastName')}`,
                data: _.get(listItem, 'userID'),
                key: _.get(listItem, 'userID'),
              }))}
              selectedItem={state.patientData.primaryPhysicianID || ''}
              setter={handleNonTextInputField('primaryPhysicianID')}
            />
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Medical Record #"
              placeholder="This is medical record number from your EHR system"
              value={state.patientData.secondaryId || ''}
              setter={handleInput}
              name="secondaryId"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <DeviceAutoCompleteInputField
              facilityId={props.facilityId}
              selectedValHandler={handleDeviceSelection}
              selectedVal={state.patientData.deviceId || ''}
              isDisabled={shouldDisableDeviceIdFieldSelector}
            />
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              isRequired
              margin="dense"
              isFullWidth
              label="First Name"
              value={state.patientData.firstName || ''}
              setter={handleInput}
              name="firstName"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Middle Name"
              value={state.patientData.middleName || ''}
              setter={handleInput}
              name="middleName"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              isRequired
              margin="dense"
              isFullWidth
              label="Last Name"
              value={state.patientData.lastName || ''}
              setter={handleInput}
              name="lastName"
            />
          </div>
        </div>
        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              // isRequired
              margin="dense"
              isFullWidth
              label="Mobile Number"
              value={state.patientData.phoneNumber || ''}
              setter={handleInput}
              name="phoneNumber"
              errorText={
                String(_.get(state.patientData, 'phoneNumber') || '').length > 0 &&
                !validatePhoneNumber(
                  _.get(state.patientData, 'country') || '',
                  _.get(state.patientData, 'phoneNumber') || '',
                )
                  ? 'Phone number is not valid'
                  : ''
              }
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Email Address"
              value={state.patientData.email || ''}
              setter={handleInput}
              name="email"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <SelectFilledInputField
              isRequired
              margin="dense"
              label="Gender"
              items={[
                { displayName: 'Male', data: 'male', key: 'xy' },
                { displayName: 'Female', data: 'female', key: 'xx' },
              ]}
              selectedItem={state.patientData.gender || 'male'}
              setter={handleNonTextInputField('gender')}
            />
          </div>
        </div>
        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              isRequired
              margin="dense"
              isFullWidth
              label="Date of birth"
              value={state.patientData.dateOfBirth || ''}
              setter={handleInput}
              name="dateOfBirth"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <SelectFilledInputField
              margin="dense"
              label="Language"
              items={
                state.languageSelectItems as {
                  displayName: string;
                  data: string;
                  key: string;
                  image?: string | undefined;
                }[]
              }
              selectedItem={state.patientData.deviceLanguage || 'en'}
              setter={handleNonTextInputField('deviceLanguage')}
            />
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell large-6 medium-12 small-12">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Weight(lbs)"
              value={state.patientData?.weight || ''}
              setter={handleInput}
              inputType="number"
              name="weight"
            />
          </div>
          <div className="general-form__content-row-field cell large-3 medium-12 small-12">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Height(Foot)"
              value={state.patientData?.heightFoot || ''}
              setter={handleInput}
              inputType="number"
              name="heightFoot"
            />
          </div>
          <div className="general-form__content-row-field cell large-3 medium-12 small-12">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Height(Inches)"
              value={state.patientData?.heightInches || ''}
              setter={handleInput}
              inputType="number"
              name="heightInches"
              errorText={
                Number(state.patientData?.heightInches || 0) > 11
                  ? `Cannot be higher than 11`
                  : undefined
              }
            />
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <div className="general-form__content-row-title general-form__content-row-title--add-top-margin">
              Patient Address
            </div>
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Address"
              value={state.patientData.address1 || ''}
              setter={handleInput}
              name="address1"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Additional Address"
              value={state.patientData.address2 || ''}
              setter={handleInput}
              name="address2"
            />
          </div>
        </div>
        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="City"
              value={state.patientData.city || ''}
              setter={handleInput}
              name="city"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <SelectFilledInputField
              margin="dense"
              label="Country"
              items={selectItemsForCountries}
              selectedItem={state.patientData.country || ''}
              setter={handleNonTextInputField('country')}
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <SelectFilledInputField
              margin="dense"
              label="State"
              items={listOfStatesUnderSelectedCountry(state.patientData.country || '')}
              selectedItem={state.patientData.state || ''}
              setter={handleNonTextInputField('state')}
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Zip"
              value={state.patientData.zip || ''}
              setter={handleInput}
              name="zip"
            />
          </div>
        </div>

        {permissions.includes(Permissions.UPDATE_PATIENT_BILLING_INFO) && (
          <>
            <div className="general-form__content-row grid-x grid-padding-x">
              <div className="general-form__content-row-field cell auto">
                <div className="general-form__content-row-title general-form__content-row-title--add-top-margin">
                  Patient Insurance Information
                </div>
              </div>
            </div>

            <div className="general-form__content-row grid-x grid-padding-x">
              <div className="general-form__content-row-field cell auto">
                <FilledTextInputField
                  margin="dense"
                  isFullWidth
                  label="Subscriber"
                  value={state.patientData.subscriber || ''}
                  setter={handleInput}
                  name="subscriber"
                />
              </div>
              <div className="general-form__content-row-field cell auto">
                <FilledTextInputField
                  margin="dense"
                  isFullWidth
                  label="Policy #"
                  value={state.patientData.policyNumber || ''}
                  setter={handleInput}
                  name="policyNumber"
                />
              </div>
              <div className="general-form__content-row-field cell auto">
                <FilledTextInputField
                  margin="dense"
                  isFullWidth
                  label="Group #"
                  value={state.patientData.groupNumber || ''}
                  setter={handleInput}
                  name="groupNumber"
                />
              </div>
            </div>
          </>
        )}

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <div className="general-form__content-row-title general-form__content-row-title--add-top-margin">
              Patient Emergency Contact
            </div>
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="First Name"
              value={state.patientData.emergencyFirstName || ''}
              setter={handleInput}
              name="emergencyFirstName"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Last Name"
              value={state.patientData.emergencyLastName || ''}
              setter={handleInput}
              name="emergencyLastName"
            />
          </div>
        </div>
        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Mobile Number"
              value={state.patientData.emergencyPhone || ''}
              setter={handleInput}
              name="emergencyPhone"
              errorText={
                String(_.get(state.patientData, 'emergencyPhone') || '').length > 0 &&
                !validatePhoneNumber('', _.get(state.patientData, 'emergencyPhone') || '')
                  ? 'Phone number is not valid'
                  : ''
              }
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Relationship"
              value={state.patientData.emergencyRelation || ''}
              setter={handleInput}
              name="emergencyRelation"
            />
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <div className="general-form__content-row-title general-form__content-row-title--add-top-margin">
              Patient Care
            </div>
          </div>
        </div>

        <div className="general-form__content-row grid-x grid-padding-x">
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Plan Of Care"
              value={state.patientData.planOfCare || ''}
              setter={handleInput}
              name="planOfCare"
            />
          </div>
          <div className="general-form__content-row-field cell auto">
            <FilledTextInputField
              margin="dense"
              isFullWidth
              label="Diagnosis"
              value={state.patientData.diagnosis || ''}
              setter={handleInput}
              name="diagnosis"
            />
          </div>
        </div>
      </div>
      <div className="general-form__actions">
        <PrimaryButton isLoading={state.isLoading} type="submit">
          Update
        </PrimaryButton>
      </div>
    </form>
  );
};

export default PatientInfoForm;
