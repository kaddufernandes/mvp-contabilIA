import React, { useState, useMemo } from 'react';
import { Calculator, DollarSign, Users, Calendar, ArrowRight, PiggyBank, Receipt, Info } from 'lucide-react';

type CalcType = 'salario' | 'ferias';

export const HrSimulatorForm: React.FC = () => {
  const [calcType, setCalcType] = useState<CalcType>('salario');
  const [salarioBruto, setSalarioBruto] = useState<string>('3000');
  const [dependentes, setDependentes] = useState<string>('0');
  
  const [diasFerias, setDiasFerias] = useState<string>('30');
  const [venderFerias, setVenderFerias] = useState<boolean>(false);

  const calcularINSS = (bruto: number) => {
    let inss = 0;
    if (bruto <= 1412.00) {
      inss = bruto * 0.075;
    } else if (bruto <= 2666.68) {
      inss = (1412.00 * 0.075) + ((bruto - 1412.00) * 0.09);
    } else if (bruto <= 4000.03) {
      inss = (1412.00 * 0.075) + ((2666.68 - 1412.00) * 0.09) + ((bruto - 2666.68) * 0.12);
    } else if (bruto <= 7786.02) {
      inss = (1412.00 * 0.075) + ((2666.68 - 1412.00) * 0.09) + ((4000.03 - 2666.68) * 0.12) + ((bruto - 4000.03) * 0.14);
    } else {
      inss = 908.85;
    }
    return inss;
  };

  const calcularIRRF = (bruto: number, inss: number, numDependentes: number) => {
    const deducaoDependentes = numDependentes * 189.59;
    const descontoSimplificado = 564.80; 
    
    const baseLegal = bruto - inss - deducaoDependentes;
    const baseSimplificada = bruto - descontoSimplificado;
    const baseCalculo = Math.min(baseLegal, baseSimplificada);

    let irrf = 0;
    if (baseCalculo <= 2259.20) {
      irrf = 0;
    } else if (baseCalculo <= 2826.65) {
      irrf = (baseCalculo * 0.075) - 169.44;
    } else if (baseCalculo <= 3751.05) {
      irrf = (baseCalculo * 0.15) - 381.44;
    } else if (baseCalculo <= 4664.68) {
      irrf = (baseCalculo * 0.225) - 662.77;
    } else {
      irrf = (baseCalculo * 0.275) - 896.00;
    }
    return Math.max(0, irrf);
  };

  const resultadoSalario = useMemo(() => {
    const bruto = parseFloat(salarioBruto) || 0;
    const deps = parseInt(dependentes) || 0;
    const inss = calcularINSS(bruto);
    const irrf = calcularIRRF(bruto, inss, deps);
    const liquido = bruto - inss - irrf;

    return { bruto, inss, irrf, liquido };
  }, [salarioBruto, dependentes]);

  const resultadoFerias = useMemo(() => {
    const brutoMensal = parseFloat(salarioBruto) || 0;
    const deps = parseInt(dependentes) || 0;
    const dias = parseInt(diasFerias) || 30;
    
    const valorFerias = (brutoMensal / 30) * dias;
    const tercoFerias = valorFerias / 3;
    const brutoFerias = valorFerias + tercoFerias;

    let abono = 0;
    let tercoAbono = 0;
    
    if (venderFerias) {
      abono = (brutoMensal / 30) * 10;
      tercoAbono = abono / 3;
    }

    const inss = calcularINSS(brutoFerias);
    const irrf = calcularIRRF(brutoFerias, inss, deps);
    
    const liquido = brutoFerias - inss - irrf + abono + tercoAbono;

    return { 
      valorFerias, 
      tercoFerias, 
      brutoFerias, 
      abono: abono + tercoAbono, 
      inss, 
      irrf, 
      liquido 
    };
  }, [salarioBruto, dependentes, diasFerias, venderFerias]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn mt-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5" />
            <span>Departamento Pessoal</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Simulador de Cálculos RH</h2>
          <p className="text-sm text-slate-400">Projeções matemáticas com base nas tabelas progressivas vigentes.</p>
        </div>

        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setCalcType('salario')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              calcType === 'salario' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Salário Líquido
          </button>
          <button
            onClick={() => setCalcType('ferias')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              calcType === 'ferias' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Cálculo de Férias
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
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 shadow-xl rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-4 mb-6 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            Extrato da Simulação
          </h3>

          {calcType === 'salario' && (
            <div className="space-y-4 flex-1">
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
                <span className="text-sm font-black text-red-400">- {formatCurrency(resultadoSalario.irrf)}</span>
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
                <span className="text-sm font-black text-red-400">- {formatCurrency(resultadoFerias.irrf)}</span>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between p-5 bg-emerald-500 rounded-2xl shadow-inner shadow-emerald-700/50">
              <div>
                <span className="block text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">
                  Valor Líquido a Receber
                </span>
                <div className="flex items-center space-x-2 text-white">
                  <ArrowRight className="w-5 h-5" />
                  <span className="text-3xl md:text-4xl font-black tracking-tight">
                    {formatCurrency(calcType === 'salario' ? resultadoSalario.liquido : resultadoFerias.liquido)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 px-2 text-slate-400 text-[10px] leading-relaxed">
              <Info className="w-4 h-4 shrink-0" />
              <p>
                Os cálculos acima são estimativas aproximadas baseadas no desconto simplificado de IRRF e alíquotas progressivas do INSS. O valor final pode variar de acordo com descontos em folha.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};