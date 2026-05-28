import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutSection } from './LayoutSection';

describe('LayoutSection', () => {
  it('clicking header toggles open and closed', async () => {
    const user = userEvent.setup();
    render(
      <LayoutSection id="text" label="Text" defaultOpen={false}>
        <p>Section body</p>
      </LayoutSection>,
    );

    const header = screen.getByRole('button', { name: 'Text' });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('pressing Enter toggles open and closed', async () => {
    const user = userEvent.setup();
    render(
      <LayoutSection id="layout" label="Layout" defaultOpen={false}>
        <p>Section body</p>
      </LayoutSection>,
    );

    const header = screen.getByRole('button', { name: 'Layout' });
    header.focus();

    await user.keyboard('{Enter}');
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Enter}');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('pressing Space toggles open and closed', async () => {
    const user = userEvent.setup();
    render(
      <LayoutSection id="media" label="Media" defaultOpen={false}>
        <p>Section body</p>
      </LayoutSection>,
    );

    const header = screen.getByRole('button', { name: 'Media' });
    header.focus();

    await user.keyboard(' ');
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-expanded reflects open state', async () => {
    const user = userEvent.setup();
    render(
      <LayoutSection id="typography" label="Typography and Color" defaultOpen={true}>
        <p>Section body</p>
      </LayoutSection>,
    );

    const header = screen.getByRole('button', { name: 'Typography and Color' });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultOpen prop is respected for initial state', () => {
    render(
      <LayoutSection id="text" label="Text" defaultOpen={true}>
        <p>Section body</p>
      </LayoutSection>,
    );
    expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders header trailing content', () => {
    render(
      <LayoutSection
        id="mark"
        label="Document Mark"
        defaultOpen={false}
        headerTrailing={<button type="button">Trailing action</button>}
      >
        <p>Section body</p>
      </LayoutSection>,
    );

    expect(screen.getByRole('button', { name: 'Trailing action' })).toBeInTheDocument();
  });

  it('clicking inside header trailing slot does not toggle section state', async () => {
    const user = userEvent.setup();
    render(
      <LayoutSection
        id="mark"
        label="Document Mark"
        defaultOpen={false}
        headerTrailing={<button type="button">Trailing action</button>}
      >
        <p>Section body</p>
      </LayoutSection>,
    );

    const header = screen.getByRole('button', { name: 'Document Mark' });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Trailing action' }));
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('controlled open prop overrides internal state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LayoutSection id="text" label="Text" defaultOpen={false} open={true} onToggle={() => {}}>
        <p>Section body</p>
      </LayoutSection>,
    );

    const header = screen.getByRole('button', { name: 'Text' });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <LayoutSection id="text" label="Text" defaultOpen={false} open={false} onToggle={() => {}}>
        <p>Section body</p>
      </LayoutSection>,
    );
    expect(header).toHaveAttribute('aria-expanded', 'false');

    // Clicking does not change state without external update
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });
});
