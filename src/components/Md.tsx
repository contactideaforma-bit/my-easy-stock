import { md } from '@/lib/markdown';

export default function Md({ text }: { text: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: md(text) }} />;
}
