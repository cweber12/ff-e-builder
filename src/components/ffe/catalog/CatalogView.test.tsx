import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogPage } from './CatalogPage';
import { resolveCatalogEditorPopoverAnchor } from './catalogEditorPopoverAnchor';
import { catalogProjectFixture, catalogRoomsFixture } from '../../../data/catalogFixture';

describe('CatalogPage', () => {
  it('anchors the editor flush to the right edge of the tool rail', () => {
    const anchor = resolveCatalogEditorPopoverAnchor(
      {
        left: 0,
        right: 208,
        top: 44,
        bottom: 920,
        x: 0,
        y: 44,
        width: 208,
        height: 876,
        toJSON() {
          return this;
        },
      } satisfies DOMRect,
      {
        left: 0,
        right: 1280,
        top: 0,
        bottom: 44,
        x: 0,
        y: 0,
        width: 1280,
        height: 44,
        toJSON() {
          return this;
        },
      } satisfies DOMRect,
    );

    expect(anchor).toEqual({ top: 45, left: 209 });
  });

  it('returns null when the rail is not measured (e.g. hidden on mobile)', () => {
    const anchor = resolveCatalogEditorPopoverAnchor(undefined, {
      left: 0,
      right: 390,
      top: 44,
      bottom: 88,
      x: 0,
      y: 44,
      width: 390,
      height: 44,
      toJSON() {
        return this;
      },
    } satisfies DOMRect);

    expect(anchor).toBeNull();
  });

  it('matches the rendered catalog page snapshot for a fixture item', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('shows the quantity-only callout beneath the main image', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(`QUANTITY: ${item.qty}`)).toBeInTheDocument();
    expect(screen.queryByText('PRICE PER ITEM')).not.toBeInTheDocument();
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add option/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add finish swatch/i })).not.toBeInTheDocument();
  });

  it('keeps text fields read-only when editor is closed', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
            editorOpen={false}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.queryByRole('button', { name: `Name for ${item.itemName}` }),
    ).not.toBeInTheDocument();
  });

  it('applies selected typography color tokens to preview title text', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
            typographyConfig={{ titleColorToken: 'slate-700' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(item.itemName.toUpperCase())).toHaveStyle({ color: '#374151' });
  });

  it('activates text fields as editable buttons when editor is open', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
            editorOpen={true}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: `Name for ${item.itemName}` })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Dimensions for ${item.itemName}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Description for ${item.itemName}` }),
    ).toBeInTheDocument();
  });

  it('does not render in-canvas layout micro-toggles regardless of editor state', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
            editorOpen={true}
            onLayoutChange={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.queryByRole('button', { name: /center image alignment/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /top image alignment/i })).not.toBeInTheDocument();
  });

  it('enters inline text edit on click when editor is open', async () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CatalogPage
            project={catalogProjectFixture}
            entry={{ room, item }}
            pageNumber={1}
            pageCount={3}
            editorOpen={true}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: `Dimensions for ${item.itemName}` }));
    expect(
      screen.getByRole('textbox', { name: `Dimensions for ${item.itemName}` }),
    ).toBeInTheDocument();
  });
});
