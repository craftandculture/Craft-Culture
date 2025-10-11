import { readFile } from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import { z } from 'zod';

import slugify from '@/app/_ui/utils/slugify';

const defaultSchema = z.object({});

const loadMarkdown = async <TSchema extends z.Schema>(
  filename: string,
  schema?: TSchema,
) => {
  /** Read the file content */
  const content = await readFile(path.join(process.cwd(), filename), 'utf-8');

  /** Parse the front matter */
  const { data: frontMatter } = matter(content);

  /** Validate the front matter */
  const meta = schema
    ? schema.parse(frontMatter)
    : defaultSchema.parse(frontMatter);

  /** Remove the .mdx extension from the slug */
  const slug = slugify(filename.replace(/\.mdx$/, ''));

  return {
    slug,
    content,
    meta: meta as z.infer<TSchema>,
  } as const;
};

export default loadMarkdown;
