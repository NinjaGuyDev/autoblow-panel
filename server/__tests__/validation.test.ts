import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseIdParam } from '../middleware/validation.js';

/** Minimal Express doubles — parseIdParam only reads params and writes a 400. */
function makeReq(params: Record<string, unknown>): Request {
  return { params } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status } as unknown as Response, status, json };
}

describe('parseIdParam', () => {
  it('parses a numeric route parameter', () => {
    const { res, status } = makeRes();

    expect(parseIdParam(makeReq({ id: '42' }), res)).toBe(42);
    expect(status).not.toHaveBeenCalled();
  });

  it('reads the named parameter when one is given', () => {
    const { res } = makeRes();

    expect(parseIdParam(makeReq({ itemId: '7' }), res, 'itemId')).toBe(7);
  });

  it('rejects a non-numeric value with a 400', () => {
    const { res, status, json } = makeRes();

    expect(parseIdParam(makeReq({ id: '12abc' }), res)).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid id parameter — must be a number' });
  });

  it('rejects a repeated route segment rather than coercing the array', () => {
    const { res, status } = makeRes();

    expect(parseIdParam(makeReq({ id: ['1', '2'] }), res)).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects a single-element array instead of unwrapping it to a number', () => {
    // The one array shape that slipped through: RegExp.test stringifies
    // ['5'] to "5", which matches, so the id silently parsed as 5
    const { res, status } = makeRes();

    expect(parseIdParam(makeReq({ id: ['5'] }), res)).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects a missing parameter', () => {
    const { res, status } = makeRes();

    expect(parseIdParam(makeReq({}), res)).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects values the strict integer pattern does not allow', () => {
    for (const raw of ['', ' 5', '5 ', '-1', '1.5', '0x10', '1e3', '+7']) {
      const { res, status } = makeRes();

      expect(parseIdParam(makeReq({ id: raw }), res)).toBeNull();
      expect(status).toHaveBeenCalledWith(400);
    }
  });

  it('names the offending parameter in the error', () => {
    const { res, json } = makeRes();

    parseIdParam(makeReq({ playlistId: 'nope' }), res, 'playlistId');

    expect(json).toHaveBeenCalledWith({
      error: 'Invalid playlistId parameter — must be a number',
    });
  });
});
