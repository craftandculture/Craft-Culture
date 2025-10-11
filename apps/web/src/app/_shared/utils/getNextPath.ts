const getNextPath = () => {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get('next');
};

export default getNextPath;
