import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/dsl/availability.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { AVAILABLE_FUNCTIONS, isAvailableFormula } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('cached and locally saved retired expressions are not offered', () => {
  assert.equal(AVAILABLE_FUNCTIONS.size, 36);
  for (const expression of [
    'PE < 20', 'roe > 15', 'MarketCap > 1', 'FloatMarketCap > 1',
    'KDJ(C,9,3,3)', 'OBV(C,V)', 'FILTER(C>O,3)',
    'TF("5m",C)', 'LAST_TF("5m",C)', 'ANY_TF("5m",C>O)', 'EVERY_TF("5m",C>O)',
    'COUNT(ROE>15 AND C>O,3)', 'x := C>O; COUNT(x AND PE>0,3)',
  ]) assert.equal(isAvailableFormula(expression), false, expression);
});

test('OHLCV examples and outer Boolean combinations remain usable', () => {
  for (const expression of [
    'COUNT(C>O AND V>0,3)', 'COUNT(NOT (C>O),3)', 'x := C>O AND V>0; COUNT(x,3)',
    'EVERY(C>O OR V>0,3)', 'EXIST(C>O AND V>0,3)',
    'MACD_DIF(C,12,26,9)', 'MACD_DEA(C,12,26,9)', 'MACD_HIST(C,12,26,9)',
    'BOLL_MID(C,20,2)', 'BOLL_UP(C,20,2)', 'BOLL_DOWN(C,20,2)', 'TR(H,L,C)', 'ATR(H,L,C,14)',
    'EMA(C,20)', 'SMA(C,20)', 'SMA(C,20,2)', 'MACD(C,12,26,9)', 'RSI(C,14)',
    'CLOSE > MA(CLOSE,20) AND VOL > MA(VOL,5)', 'AMOUNT > 1e9',
    'CROSS(MA(C,5),MA(C,20))', 'COUNT(C>O,3)', 'CCI(H,L,C,14)',
    'WR(H,L,C,14)', 'NOT (C > MA(C,20))',
    'COUNT(C>O,3)>1 AND V>0', 'MA(C,20) // formerly used ROE and ATR',
  ]) assert.equal(isAvailableFormula(expression), true, expression);
});
