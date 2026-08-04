import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, Users, Calendar, ArrowRight, PiggyBank, Receipt, Info, Gift, Wallet } from 'lucide-react';

type CalcType = 'salario' | 'ferias' | 'decimoTerceiro';

// ==========================================================================
// TABELAS OFICIAIS VIGENTES EM 2026
// ==========================================================================
// INSS 2026 (empregado CLT) — alíquotas progressivas por faixa.
// Fonte: Previdência Social / tabela publicada para competência 2026.
const FAIXAS_INSS_2026 = [
  { limite: 1621.0, aliquota: 0.075 },
  { limite: 2902.84, aliquota: 0.09 },
  { limite: 4354.27, aliquota: 0.12 },
  { limite: 8475.55, aliquota: 0.14 },
];
const TETO_INSS_2026 = 988.09; // contribuição máxima para salários acima do teto

// IRRF 2026 — tabela progressiva mensal (inalterada desde a atualização de 2024,
// conforme confirmado pela Receita Federal para o ano-calendário 2026).
const FAIXAS_IRRF_2026 = [
  { limite: 2428.8, aliquota: 0, deducao: 0 },
  { limite: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { limite: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { limite: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { limite: Infinity, aliquota: 0.275, deducao: 908.73 },
];

const DEDUCAO_POR_DEPENDENTE = 189.59;
const DESCONTO_SIMPLIFICADO_IRRF = 607.2; // 25% do limite da 1ª faixa (R$ 2.428,80)

// Lei nº 15.270/2025 — redução do IRRF vigente a partir de janeiro/2026:
// - Rendimento bruto mensal até R$ 5.000,00: imposto zerado.
// - Entre R$ 5.000,01 e R$ 7.350,00: redutor decrescente.
// - Acima de R$ 7.350,00: sem redução, tabela tradicional integral.
const LIMITE_ISENCAO_LEI_15270 = 5000;
const LIMITE_REDUCAO_LEI_15270 = 7350;

export const HrSimulatorForm: React.FC = () => {
  const [calcType, setCalcType] = useState<CalcType>('salario');
  const [salarioBruto, setSalarioBruto] = useState<string>('3000');
  const [dependentes, setDependentes] = useState<string>('0');

  const [diasFerias, setDiasFerias] = useState<string>('30');
  const [venderFerias, setVenderFerias] = useState<boolean>(false);

  const [mesesTrabalhados, setMesesTrabalhados] = useState<string>('12');

  // ------------------------------------------------------------------------
  // INSS — cálculo progressivo por faixa (2026)
  // ------------------------------------------------------------------------
  const calcularINSS = (bruto: number): number => {
    if (bruto <= 0) return 0;
    let inss = 0;
    let limiteAnterior = 0;
    for (const faixa of FAIXAS_INSS_2026) {
      if (bruto > faixa.limite) {
        inss += (faixa.limite - limiteAnterior) * faixa.aliquota;
        limiteAnterior = faixa.limite;
      } else {
        inss += (bruto - limiteAnterior) * faixa.aliquota;
        return inss;
      }
    }
    return TETO_INSS_2026;
  };

  // ------------------------------------------------------------------------
  // IRRF — tabela tradicional + redução da Lei 15.270/2025 (2026)
  // ------------------------------------------------------------------------
  const calcularIRRFTabela = (baseCalculo: number): number => {
    if (baseCalculo <= 0) return 0;
    for (const faixa of FAIXAS_IRRF_2026) {
      if (baseCalculo <= faixa.limite) {
        return Math.max(0, baseCalculo * faixa.aliquota - faixa.deducao);
      }
    }
    return 0;
  };

  const calcularIRRFCompleto = (rendimentoBruto: number, inss: number, numDependentes: number) => {
    const deducaoDependentes = numDependentes * DEDUCAO_POR_DEPENDENTE;

    // A fonte pagadora deve usar o método mais vantajoso ao trabalhador:
    // deduções legais (INSS + dependentes) OU desconto simplificado mensal.
    const baseLegal = Math.max(0, rendimentoBruto - inss - deducaoDependentes);
    const baseSimplificada = Math.max(0, rendimentoBruto - DESCONTO_SIMPLIFICADO_IRRF);
    const baseCalculo = Math.min(baseLegal, baseSimplificada);

    const irrfTabela = calcularIRRFTabela(baseCalculo);

    // Redução Lei 15.270/2025, aplicada sobre o rendimento bruto (não sobre a base de cálculo)
    let reducaoLei = 0;
    if (rendimentoBruto <= LIMITE_ISENCAO_LEI_15270) {
      reducaoLei = irrfTabela;
    } else if (rendimentoBruto <= LIMITE_REDUCAO_LEI_15270) {
      reducaoLei = Math.max(0, 978.62 - 0.133145 * rendimentoBruto);
    }
    reducaoLei = Math.min(reducaoLei, irrfTabela);

    const irrfFinal = Math.max(0, irrfTabela - reducaoLei);

    return { baseCalculo, irrfTabela, reducaoLei, irrfFinal };
  };

  // ------------------------------------------------------------------------
  // Salário Líquido
  // ------------------------------------------------------------------------
  const resultadoSalario = useMemo(() => {
    const bruto = parseFloat(salarioBruto) || 0;
    const deps = parseInt(dependentes) || 0;
    const inss = calcularINSS(bruto);
    const irrfInfo = calcularIRRFCompleto(bruto, inss, deps);
    const liquido = bruto - inss - irrfInfo.irrfFinal;
    const fgts = bruto * 0.08;

    return { bruto, inss, irrfInfo, liquido, fgts };
  }, [salarioBruto, dependentes]);

  // ------------------------------------------------------------------------
  // Férias
  // ------------------------------------------------------------------------
  const resultadoFerias = useMemo(() => {
    const brutoMensal = parseFloat(salarioBruto) || 0;
    const deps = parseInt(dependentes) || 0;
    const dias = parseInt(diasFerias) || 30;

    const valorFerias = (brutoMensal / 30) * dias;
    const tercoFerias = valorFerias / 3;
    const brutoFerias = valorFerias + tercoFerias;

    // Abono pecuniário (venda de 10 dias) e seu 1/3 são verbas indenizatórias:
    // não sofrem incidência de INSS nem de IRRF.
    let abono = 0;
    let tercoAbono = 0;
    if (venderFerias) {
      abono = (brutoMensal / 30) * 10;
      tercoAbono = abono / 3;
    }

    const inss = calcularINSS(brutoFerias);
    const irrfInfo = calcularIRRFCompleto(brutoFerias, inss, deps);

    const liquido = brutoFerias - inss - irrfInfo.irrfFinal + abono + tercoAbono;
    const fgts = brutoFerias * 0.08;

    return {
      valorFerias,
      tercoFerias,
      brutoFerias,
      abono: abono + tercoAbono,
      inss,
      irrfInfo,
      liquido,
      fgts,
    };
  }, [salarioBruto, dependentes, diasFerias, venderFerias]);

  // ------------------------------------------------------------------------
  // 13º Salário
  // ------------------------------------------------------------------------
  const resultadoDecimoTerceiro = useMemo(() => {
    const brutoMensal = parseFloat(salarioBruto) || 0;
    const deps = parseInt(dependentes) || 0;
    const meses = Math.min(12, Math.max(1, parseInt(mesesTrabalhados) || 12));

    const decimoBruto = (brutoMensal / 12) * meses;

    // 1ª parcela: metade do valor bruto, paga sem descontos (até 30/11).
    const primeiraParcela = decimoBruto / 2;
    const segundaParcelaBruta = decimoBruto - primeiraParcela;

    // INSS e IRRF incidem sobre o valor CHEIO do 13º e são descontados
    // integralmente na 2ª parcela (até 20/12).
    const inss = calcularINSS(decimoBruto);
    const irrfInfo = calcularIRRFCompleto(decimoBruto, inss, deps);

    const segundaParcelaLiquida = segundaParcelaBruta - inss - irrfInfo.irrfFinal;
    const liquidoTotal = primeiraParcela + segundaParcelaLiquida;
    const fgts = decimoBruto * 0.08;

    return {
      decimoBruto,
      primeiraParcela,
      segundaParcelaBruta,
      inss,
      irrfInfo,
      segundaParcelaLiquida,
      liquidoTotal,
      fgts,
    };
  }, [salarioBruto, dependentes, mesesTrabalhados]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const liquidoFinal =
    calcType === 'salario'
      ? resultadoSalario.liquido
      : calcType === 'ferias'
      ? resultadoFerias.liquido
      : resultadoDecimoTerceiro.liquidoTotal;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn mt-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5" />
            <span>Departamento Pessoal</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Simulador de Cálculos RH</h2>
          <p className="text-sm text-slate-400">Tabelas de INSS e IRRF vigentes em 2026, com a redução da Lei nº 15.270/2025.</p>
        </div>

        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setCalcType('salario')}
            className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              calcType === 'salario'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Salário Líquido
          </button>
          <button
            onClick={() => setCalcType('ferias')}
            className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              calcType === 'ferias'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Cálculo de Férias
          </button>
          <button
            onClick={() => setCalcType('decimoTerceiro')}
            className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              calcType === 'decimoTerceiro'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            13º Salário
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 space-y-6">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-600" />
            Parâmetros Base
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Salário Bruto (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  value={salarioBruto}
                  onChange={(e) => setSalarioBruto(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  placeholder="Ex: 3500.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                Número de Dependentes
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={dependentes}
                  onChange={(e) => setDependentes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                />
              </div>
            </div>

            {calcType === 'ferias' && (
              <>
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Dias de Férias a Gozar
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={diasFerias}
                      onChange={(e) => setDiasFerias(e.target.value)}
                      disabled={venderFerias}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 disabled:opacity-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div>
                    <span className="block text-sm font-bold text-slate-900">Abono Pecuniário</span>
                    <span className="block text-xs text-slate-600">Vender 10 dias de férias</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={venderFerias}
                      onChange={(e) => {
                        setVenderFerias(e.target.checked);
                        if (e.target.checked) setDiasFerias('20');
                        else setDiasFerias('30');
                      }}
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </>
            )}

            {calcType === 'decimoTerceiro' && (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Meses Trabalhados no Ano
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={mesesTrabalhados}
                    onChange={(e) => setMesesTrabalhados(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Considere um mês trabalhado a partir de 15 dias de vínculo no mês.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 shadow-xl rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-4 mb-6 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            Extrato da Simulação
          </h3>

          {calcType === 'salario' && (
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Salário Base (Provento)</span>
                <span className="text-sm font-black text-white">{formatCurrency(resultadoSalario.bruto)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Desconto INSS</span>
                <span className="text-sm font-black text-red-400">- {formatCurrency(resultadoSalario.inss)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Desconto IRRF</span>
                <span className="text-sm font-black text-red-400">
                  - {formatCurrency(resultadoSalario.irrfInfo.irrfFinal)}
                </span>
              </div>

              {resultadoSalario.irrfInfo.reducaoLei > 0 && (
                <div className="flex justify-between items-center p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg">
                  <span className="text-sm font-semibold text-slate-300">Redução Lei nº 15.270/2025</span>
                  <span className="text-sm font-black text-emerald-400">
                    + {formatCurrency(resultadoSalario.irrfInfo.reducaoLei)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                <span className="text-xs font-semibold text-slate-400">FGTS (8% — depósito do empregador)</span>
                <span className="text-xs font-bold text-slate-400">{formatCurrency(resultadoSalario.fgts)}</span>
              </div>
            </div>
          )}

          {calcType === 'ferias' && (
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Férias Proporcionais ({diasFerias} dias)</span>
                <span className="text-sm font-black text-white">{formatCurrency(resultadoFerias.valorFerias)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">1/3 Constitucional de Férias</span>
                <span className="text-sm font-black text-white">{formatCurrency(resultadoFerias.tercoFerias)}</span>
              </div>

              {venderFerias && (
                <div className="flex justify-between items-center p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg">
                  <span className="text-sm font-semibold text-slate-300">Abono Pecuniário (10 dias) + 1/3</span>
                  <span className="text-sm font-black text-emerald-400">{formatCurrency(resultadoFerias.abono)}</span>
                </div>
              )}

              <div className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Desconto INSS</span>
                <span className="text-sm font-black text-red-400">- {formatCurrency(resultadoFerias.inss)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Desconto IRRF</span>
                <span className="text-sm font-black text-red-400">
                  - {formatCurrency(resultadoFerias.irrfInfo.irrfFinal)}
                </span>
              </div>

              {resultadoFerias.irrfInfo.reducaoLei > 0 && (
                <div className="flex justify-between items-center p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg">
                  <span className="text-sm font-semibold text-slate-300">Redução Lei nº 15.270/2025</span>
                  <span className="text-sm font-black text-emerald-400">
                    + {formatCurrency(resultadoFerias.irrfInfo.reducaoLei)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                <span className="text-xs font-semibold text-slate-400">FGTS (8% — depósito do empregador)</span>
                <span className="text-xs font-bold text-slate-400">{formatCurrency(resultadoFerias.fgts)}</span>
              </div>
            </div>
          )}

          {calcType === 'decimoTerceiro' && (
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">13º Salário Bruto ({mesesTrabalhados}/12 avos)</span>
                <span className="text-sm font-black text-white">{formatCurrency(resultadoDecimoTerceiro.decimoBruto)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">1ª Parcela (sem descontos, até 30/11)</span>
                <span className="text-sm font-black text-white">
                  {formatCurrency(resultadoDecimoTerceiro.primeiraParcela)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">2ª Parcela Bruta (até 20/12)</span>
                <span className="text-sm font-black text-white">
                  {formatCurrency(resultadoDecimoTerceiro.segundaParcelaBruta)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Desconto INSS (s/ valor total do 13º)</span>
                <span className="text-sm font-black text-red-400">- {formatCurrency(resultadoDecimoTerceiro.inss)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-900/10 border border-red-500/10 rounded-lg">
                <span className="text-sm font-semibold text-slate-300">Desconto IRRF (s/ valor total do 13º)</span>
                <span className="text-sm font-black text-red-400">
                  - {formatCurrency(resultadoDecimoTerceiro.irrfInfo.irrfFinal)}
                </span>
              </div>

              {resultadoDecimoTerceiro.irrfInfo.reducaoLei > 0 && (
                <div className="flex justify-between items-center p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg">
                  <span className="text-sm font-semibold text-slate-300">Redução Lei nº 15.270/2025</span>
                  <span className="text-sm font-black text-emerald-400">
                    + {formatCurrency(resultadoDecimoTerceiro.irrfInfo.reducaoLei)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                <span className="text-xs font-semibold text-slate-400">FGTS (8% — depósito do empregador)</span>
                <span className="text-xs font-bold text-slate-400">{formatCurrency(resultadoDecimoTerceiro.fgts)}</span>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between p-5 bg-emerald-500 rounded-2xl shadow-inner shadow-emerald-700/50">
              <div>
                <span className="block text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">
                  {calcType === 'decimoTerceiro' ? 'Total Líquido a Receber (1ª + 2ª parcela)' : 'Valor Líquido a Receber'}
                </span>
                <div className="flex items-center space-x-2 text-white">
                  <ArrowRight className="w-5 h-5" />
                  <span className="text-3xl md:text-4xl font-black tracking-tight">{formatCurrency(liquidoFinal)}</span>
                </div>
              </div>
              {calcType === 'decimoTerceiro' ? (
                <Gift className="w-10 h-10 text-white/40 shrink-0" />
              ) : (
                <Wallet className="w-10 h-10 text-white/40 shrink-0" />
              )}
            </div>
            <div className="mt-4 flex items-start gap-2 px-2 text-slate-400 text-[10px] leading-relaxed">
              <Info className="w-4 h-4 shrink-0" />
              <p>
                Simulação baseada na tabela do INSS vigente em 2026 (alíquotas de 7,5% a 14%, teto de
                contribuição R$ 988,09) e na tabela do IRRF com a redução da Lei nº 15.270/2025 (isenção
                total até R$ 5.000,00 de rendimento bruto mensal e redução parcial até R$ 7.350,00). O FGTS
                é meramente informativo: é depositado pelo empregador e não é descontado do salário. Os
                valores são estimativas e podem variar conforme acordos coletivos, convenções sindicais e
                outras rubricas da folha de pagamento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};