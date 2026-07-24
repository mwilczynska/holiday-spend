import { describe, expect, it } from 'vitest';
import {
  parseVietnamRegisterCsrf,
  parseVietnamRegisterLastPage,
  parseVietnamRegisterListings,
  parseVietnamRegisterTotal,
} from './vietnam-accommodation-register';

const fixture = `
  <form><input name="csrf_name" value="frozen-token"></form>
  <h5>Tổng số: 16 kết quả</h5>
  <div><h4><a href="/cslt/?item=1586">Khách sạn À La Carte Đà Nẵng</a></h4>
    <span><i class="fa fa-map-marker" aria-hidden="true"></i>&nbsp;
      Địa chỉ: 200 Võ Nguyên Giáp, Thành phố Đà Nẵng
    </span>
  </div>
  <div><h4><a href="/cslt/?item=2369">Eden &amp; Plaza</a></h4>
    <span><i class="fa fa-map-marker" aria-hidden="true"></i>&nbsp;
      Địa chỉ: 05 Duy Tân, Hải Châu, Thành phố Đà Nẵng
    </span>
  </div>
  <div><h4><a href="/cslt/?item=9999">Missing Address Hotel</a></h4></div>
  <a href="?page=2">2</a><a href="?page=11">Cuối cùng</a>
`;

describe('Vietnam accommodation register parser', () => {
  it('extracts the source contract and pagination', () => {
    expect(parseVietnamRegisterCsrf(fixture)).toBe('frozen-token');
    expect(parseVietnamRegisterTotal(fixture)).toBe(16);
    expect(parseVietnamRegisterLastPage(fixture)).toBe(11);
  });

  it('extracts stable property ids, names, and addresses', () => {
    expect(parseVietnamRegisterListings(fixture)).toEqual([
      {
        sourcePropertyId: '1586',
        name: 'Khách sạn À La Carte Đà Nẵng',
        address: '200 Võ Nguyên Giáp, Thành phố Đà Nẵng',
      },
      {
        sourcePropertyId: '2369',
        name: 'Eden & Plaza',
        address: '05 Duy Tân, Hải Châu, Thành phố Đà Nẵng',
      },
      {
        sourcePropertyId: '9999',
        name: 'Missing Address Hotel',
        address: null,
      },
    ]);
  });
});
