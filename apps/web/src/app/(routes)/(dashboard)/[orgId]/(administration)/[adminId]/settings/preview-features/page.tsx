import SettingDocumentLimit from '@/app/_settings/components/SettingDocumentLimit';
import SettingUseFinancialMutationProcessing from '@/app/_settings/components/SettingUseFinancialMutationProcessing';
import SettingUsePaypalReconciliation from '@/app/_settings/components/SettingUsePaypalReconciliation';

const Page = async () => {
  return (
    <>
      <SettingDocumentLimit />
      <SettingUseFinancialMutationProcessing />
      <SettingUsePaypalReconciliation />
    </>
  );
};

export default Page;
