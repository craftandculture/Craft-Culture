'use client';

import { IconCameraOff } from '@tabler/icons-react';
import Image from 'next/image';
import { type VariantProps, tv } from 'tailwind-variants';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

const productPreviewStyles = tv({
  slots: {
    root: 'flex min-w-0 items-center gap-2',
    imageContainer:
      'relative flex size-7 shrink-0 items-center justify-center rounded-lg',
    image: 'size-7 object-contain',
    nameContainer: 'min-w-0 flex-1',
  },
});

interface ProductPreviewProps
  extends VariantProps<typeof productPreviewStyles> {
  imageUrl?: string | null;
  name: string;
  year?: number | null;
  unitCount?: number;
  unitSize?: string;
  className?: string;
}

const ProductPreview = ({ imageUrl, name, className }: ProductPreviewProps) => {
  const { root, imageContainer, image, nameContainer } = productPreviewStyles();

  return (
    <div className={root({ className })}>
      {/* Product Image */}
      <div className={imageContainer()}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={32}
            height={32}
            className={image()}
          />
        ) : (
          <Icon icon={IconCameraOff} colorRole="muted" size="sm" />
        )}
      </div>

      {/* Product Name and Unit Info */}
      <div className={nameContainer()}>
        <Typography variant="bodySm" className="truncate text-left">
          {name}
        </Typography>
      </div>
    </div>
  );
};

export default ProductPreview;
