import { IconBrandWhatsapp, IconMail } from '@tabler/icons-react';

const WHATSAPP_URL = 'https://wa.me/971581498156';

/** WhatsApp and email to the team */
const ContactLinks = () => (
  <div className="flex flex-wrap gap-4 text-sm">
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      className="text-text-brand inline-flex items-center gap-1.5 font-semibold"
    >
      <IconBrandWhatsapp size={18} /> WhatsApp us
    </a>
    <a
      href="mailto:kevin@craftculture.xyz"
      className="text-text-brand inline-flex items-center gap-1.5 font-semibold"
    >
      <IconMail size={18} /> Email us
    </a>
  </div>
);

export default ContactLinks;
