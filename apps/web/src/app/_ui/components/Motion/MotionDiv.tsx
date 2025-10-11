'use client';

import { motion } from 'motion/react';

export interface MotionDivProps
  extends React.ComponentProps<typeof motion.div> {}

const MotionDiv = ({ children, ...props }: MotionDivProps) => {
  return <motion.div {...props}>{children}</motion.div>;
};

export default MotionDiv;
