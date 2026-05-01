import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogPage } from './CatalogView';
import { catalogProjectFixture, catalogRoomsFixture } from '../data/catalogFixture';

describe('CatalogPage', () => {
  it('matches the rendered catalog page snapshot for a fixture item', () => {
    const room = catalogRoomsFixture[0]!;
    const item = room.items[0]!;
    const { container } = render(
      <MemoryRouter>
        <CatalogPage
          project={catalogProjectFixture}
          entry={{ room, item }}
          pageNumber={1}
          pageCount={3}
        />
      </MemoryRouter>,
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
