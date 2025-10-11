const websiteConfig = {
  team: [
    {
      name: 'Jasper Verbeet',
      linkedIn: 'https://www.linkedin.com/in/jasperverbeet/',
      avatar: async () =>
        (await import('@/public/jasper-verbeet.jpeg')).default,
    },
  ],
} as const;

export default websiteConfig;
