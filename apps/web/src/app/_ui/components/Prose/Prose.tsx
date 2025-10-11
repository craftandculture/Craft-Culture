export interface ProseProps extends React.HTMLAttributes<HTMLDivElement> {}

const Prose = ({ children, ...props }: ProseProps) => {
  return (
    <div className="prose dark:prose-invert" {...props}>
      {children}
    </div>
  );
};

export default Prose;
