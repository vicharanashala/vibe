import { render } from '@testing-library/react';

import { GeneratedAvatar, GeneratedCover, initialsOf } from './generated-art';

// Compare the drawing itself; React gives every instance its own mask/filter ids.
const svgOf = (ui: React.ReactElement) => render(ui).container.querySelector('svg')!.innerHTML.replace(/_r_\w+?_/g, 'ID');

describe('generated art', () => {
  it('draws the same picture for the same seed and a different one for another', () => {
    const a = svgOf(<GeneratedCover seed="course-a" title="Data Structures" />);
    const again = svgOf(<GeneratedCover seed="course-a" title="Data Structures" />);
    const b = svgOf(<GeneratedCover seed="course-b" title="Data Structures" />);
    expect(again).toBe(a);
    expect(b).not.toBe(a);
  });

  it('gives each person a stable avatar', () => {
    expect(svgOf(<GeneratedAvatar seed="uid-1" />)).toBe(svgOf(<GeneratedAvatar seed="uid-1" />));
    expect(svgOf(<GeneratedAvatar seed="uid-1" />)).not.toBe(svgOf(<GeneratedAvatar seed="uid-2" />));
  });

  it('labels covers with meaningful initials', () => {
    expect(initialsOf('Sample: Foundations of Data Structures')).toBe('FD');
    expect(initialsOf('The Art of Computer Programming')).toBe('AC');
  });
});
