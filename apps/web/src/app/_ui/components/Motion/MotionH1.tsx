'use client';

import { motion } from 'motion/react';

export interface MotionH1Props extends React.ComponentProps<typeof motion.h1> {}

const MotionH1 = ({ children, ...props }: MotionH1Props) => {
  return <motion.h1 {...props}>{children}</motion.h1>;
};

export default MotionH1;
