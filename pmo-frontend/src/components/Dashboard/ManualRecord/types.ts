import { UnitType } from '../../../types/CadernoTypes';

export interface ManualRecordTabProps<T> {
    draft: T;
    updateDraft: (field: string, value: any) => void;
    errors: Record<string, string>;
    isEditMode: boolean;
    // Specific handlers/data (optional)
    checkInsumoOrganico?: (val: string) => void;
    organicWarning?: { msg: string } | null;
}

export type { UnitType };
