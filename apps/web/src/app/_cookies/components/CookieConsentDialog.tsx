import { DialogProps } from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Link from '@/app/_ui/components/Link/Link';

import CookiePreference from './CookiePreference';
import useCookieConsent from '../hooks/useCookieConsent';

export interface CookieConsentDialogProps extends DialogProps {}

const CookieConsentDialog = ({
  open,
  onOpenChange,
}: CookieConsentDialogProps) => {
  const {
    consented,
    preferences,
    analytics,
    marketing,
    setConsent,
    hideCookieDialog,
  } = useCookieConsent();

  const [customizationOpen, setCustomizationOpen] = useState(false);

  const [newPreferences, setPreferences] = useState(preferences);
  const [newAnalytics, setAnalytics] = useState(analytics);
  const [newMarketing, setMarketing] = useState(marketing);

  useEffect(() => {
    setPreferences(preferences);
    setAnalytics(analytics);
    setMarketing(marketing);
  }, [preferences, analytics, marketing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventClosing={!consented} className="max-w-sm">
        <DialogHeader>
          <DialogTitle variant="labelMd">Cookie instellingen</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription colorRole="muted" variant="bodySm">
            Wij gebruiken cookies om uw ervaring te personaliseren en te
            analyseren. Lees ons{' '}
            <Link
              href="/policies/privacy"
              onClick={() => hideCookieDialog()}
              variant="bodySm"
              colorRole="muted"
              showUnderline
            >
              Privacybeleid
            </Link>
            .
          </DialogDescription>

          {customizationOpen ? (
            <>
              <div className="flex flex-col gap-1.5">
                <CookiePreference
                  alwaysActive
                  title="Noodzakelijk"
                  description="Zorgt voor de juiste technische werking van onze diensten."
                />
                <CookiePreference
                  title="Voorkeuren"
                  description="Maakt het opslaan van uw voorkeuren en instellingen mogelijk."
                  value={newPreferences}
                  onChange={setPreferences}
                />
                <CookiePreference
                  title="Analytics"
                  description="Maakt analyse en verbetering van de prestaties van onze diensten mogelijk."
                  value={newAnalytics}
                  onChange={setAnalytics}
                />
                <CookiePreference
                  title="Marketing"
                  description="Maakt gerichte communicatie met de meest relevante inhoud en gepersonaliseerde communicatie op onze en derde partij websites mogelijk."
                  value={newMarketing}
                  onChange={setMarketing}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="grow"
                  size="sm"
                  onClick={() => {
                    setConsent({
                      consented: true,
                      preferences: newPreferences,
                      analytics: newAnalytics,
                      marketing: newMarketing,
                    });

                    setTimeout(() => {
                      setCustomizationOpen(false);
                    }, 300);

                    hideCookieDialog();
                  }}
                >
                  <ButtonContent>Opslaan</ButtonContent>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3">
                <Button
                  className="grow"
                  colorRole="primary"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomizationOpen(true);
                  }}
                >
                  <ButtonContent>Aanpassen</ButtonContent>
                </Button>
                <Button
                  className="grow"
                  size="sm"
                  onClick={() => {
                    setConsent({
                      consented: true,
                      preferences: true,
                      analytics: true,
                      marketing: true,
                    });
                    hideCookieDialog();
                  }}
                >
                  <ButtonContent>Alles accepteren</ButtonContent>
                </Button>
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default CookieConsentDialog;
