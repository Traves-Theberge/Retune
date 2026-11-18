import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Undo2 } from 'lucide-react';
import { Button, IconButton, Row, ScrubInput, Section, Segmented } from '../components/ui';
import { createClassEditor } from '../components/controls';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const OLD_PALETTE = /zinc-|indigo-|rose-|emerald-|amber-|#[0-9a-f]{6}/i;

describe('ui primitives', () => {
  it('renders an accessible segmented control', () => {
    const out = html(<Segmented label="Viewport" active="b" onPick={() => {}} options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />);
    expect(out).toContain('role="radiogroup"'); expect(out).toContain('aria-label="Viewport"');
    expect(out).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>B</);
    expect(out.match(/tabindex="0"/g)?.length).toBe(1);
  });
  it('names the scrub inputs', () => {
    const out = html(<ScrubInput label="pad X" value="14px" min={0} max={64} onChange={() => {}} onClear={() => {}} />);
    expect(out).toContain('aria-label="pad X"');
    expect(out).toContain('aria-label="pad X value"');
  });
  it('shows no selection when no option is active', () => {
    const out = html(<Segmented onPick={() => {}} options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />);
    expect(out.match(/aria-checked="true"/g)?.length ?? 0).toBe(0);
    expect(out.match(/tabindex="0"/g)?.length).toBe(1);
  });
  it('labels icon buttons and exposes pressed state only when given', () => {
    expect(html(<IconButton icon={Undo2} label="Undo" />)).toMatch(/aria-label="Undo"[^>]*title="Undo"|title="Undo"[^>]*aria-label="Undo"/);
    expect(html(<IconButton icon={Undo2} label="Undo" />)).not.toContain('aria-pressed');
    expect(html(<IconButton icon={Undo2} label="Grid" active />)).toContain('aria-pressed="true"');
  });
  it('exposes section state and hides closed content', () => {
    expect(html(<Section title="Layout" count={3}>body</Section>)).toMatch(/aria-expanded="true"/);
    const closed = html(<Section title="Layout" defaultOpen={false}>body</Section>);
    expect(closed).toContain('aria-expanded="false"'); expect(closed).not.toContain('body');
  });
  it('shows an unset numeric control as a dash and a set one as its number', () => {
    expect(html(<ScrubInput value={undefined} min={0} max={64} onChange={() => {}} onClear={() => {}} />)).toContain('placeholder="–"');
    expect(html(<ScrubInput value="14px" min={0} max={64} onChange={() => {}} onClear={() => {}} />)).toContain('value="14"');
  });
  it('uses only token colours', () => {
    const ed = createClassEditor('px-[14px] bg-indigo-600', () => {});
    const out = html(<div><Button variant="primary">Sync</Button><Row label="x">y</Row>{ed.lenRow('pad X', 'px', [], 0, 64)}{ed.col('bg')}{ed.weight}</div>);
    expect(out.replace(/value="[^"]*"/g, '')).not.toMatch(OLD_PALETTE);
    expect(out).toContain('pad X'); expect(out).toContain('value="14"');
  });

  it('populates layout, typography, and appearance controls from standard scale tokens and computedStyle', () => {
    const scaleEd = createClassEditor('px-4 text-sm font-semibold rounded-lg', () => {});
    const scaleHtml = html(
      <div>
        {scaleEd.lenRow('pad X', 'px', [], 0, 64)}
        {scaleEd.lenRow('size', 'text', [], 8, 64)}
        {scaleEd.weight}
        {scaleEd.radiusPresets}
      </div>
    );
    expect(scaleHtml).toContain('value="16"');
    expect(scaleHtml).toContain('value="14"');
    expect(scaleHtml).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>600</);
    expect(scaleHtml).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>lg</);

    const compEd = createClassEditor('primary', () => {}, 'none', {
      px: '24px',
      py: '12px',
      w: '140px',
      text: '15px',
      fontWeight: '700',
      bgColor: '#204b3b',
      textColor: '#ffffff',
      rounded: '12px',
      opacity: '0.9',
    });
    const compHtml = html(
      <div>
        {compEd.lenRow('pad X', 'px', [], 0, 64)}
        {compEd.col('bg')}
        {compEd.weight}
        {compEd.radiusPresets}
        {compEd.opacity}
      </div>
    );
    expect(compHtml).toContain('value="24"');
    expect(compHtml).toContain('value="#204b3b"');
    expect(compHtml).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>700</);
    expect(compHtml).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>xl</);
    expect(compHtml).toContain('value="0.9"');
  });
});
