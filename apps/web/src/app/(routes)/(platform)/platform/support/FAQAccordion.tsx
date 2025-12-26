'use client';

import { IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQAccordionProps {
  items: FAQItem[];
}

/**
 * An expandable FAQ accordion for common questions
 */
const FAQAccordion = ({ items }: FAQAccordionProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="divide-y divide-border-primary rounded-lg border border-border-primary">
      {items.map((item, index) => (
        <div key={index}>
          <button
            onClick={() => toggleItem(index)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-fill-secondary/50"
            aria-expanded={openIndex === index}
          >
            <Typography variant="bodySm" className="font-medium">
              {item.question}
            </Typography>
            <Icon
              icon={IconChevronDown}
              size="sm"
              colorRole="muted"
              className={`shrink-0 transition-transform duration-200 ${
                openIndex === index ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-200 ${
              openIndex === index ? 'max-h-96' : 'max-h-0'
            }`}
          >
            <div className="px-4 pb-4 pt-1">
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                {item.answer}
              </Typography>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FAQAccordion;
