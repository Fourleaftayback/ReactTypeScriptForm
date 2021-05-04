export interface Props {
  patientId: string;
  facilityId: string;
  closeModal?: () => void | Promise<void>;
}

export interface LocalState {
  patientData: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    country?: string;
    state?: string;
    zip?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    gender?: string;
    emergencyFirstName?: string;
    emergencyLastName?: string;
    emergencyPhone?: string;
    emergencyRelation?: string;
    deviceLanguage?: string;
    isTCM?: boolean;
    subscriber?: string;
    groupNumber?: string;
    policyNumber?: string;
    primaryPhysicianID?: string;
    secondaryId?: string;
    deviceId?: string;
    email?: string;
    planOfCare?: string;
    diagnosis?: string;
    weight?: string;
    heightFoot?: string;
    heightInches?: string;
  };
  isLoading: boolean;
  physicianDataList: object[];
  prevPrimaryPhysicianID: string;
  availableDevicesList: object[];
  languageSelectItems: object[];
  previousDeviceId: null | string;
  patientAccountId: null | string;
}
