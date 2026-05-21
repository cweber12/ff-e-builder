import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogPage } from './CatalogView';
import { catalogProjectFixture, catalogRoomsFixture } from '../../../data/catalogFixture';

describe('CatalogPage', () => {
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

  it('collapses the image band to a quantity callout when cost information is hidden', () => {
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
            showCostInfo={false}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('QUANTITY')).toBeInTheDocument();
    expect(screen.queryByText('PRICE PER ITEM')).not.toBeInTheDocument();
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument();
  });

  it('marks the main rendering alignment so export prep can switch between center and top', () => {
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
            mainImageAlignment="top"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(container.querySelector('[data-main-image-alignment="top"]')).toBeTruthy();
  });
});
