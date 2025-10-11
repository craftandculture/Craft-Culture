'use client';

import { motion } from 'motion/react';

export interface MotionPProps extends React.ComponentProps<typeof motion.p> {}

const MotionP = ({ children, ...props }: MotionPProps) => {
  return <motion.p {...props}>{children}</motion.p>;
};

export default MotionP;
