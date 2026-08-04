# Andrej Karpathy Guidelines & Skills (Workspace Default)

Este repositório segue os princípios e diretrizes de desenvolvimento inspirados pela filosofia de Andrej Karpathy:

## 1. Simplicidade e Clareza Acima de Abstrações Complexas
- **Sem Overengineering:** Prefira código claro, explícito e legível a padrões excessivamente abstratos ou com muitas camadas desnecessárias.
- **Módulos Enxutos:** Funções e módulos devem ter responsabilidades únicas e bem definidas.

## 2. Engenharia Empírica e Baseada em Evidências
- **Inspecione Antes de Modificar:** Nunca adivinhe lógica, schemas ou caminhos de arquivos. Leia o código relevante primeiro.
- **Diagnóstico por Logs:** Analise o erro exato e tracebacks de runtime antes de propor soluções.
- **Sem Correções Superficiais:** Nunca masque erros, engula exceções ou retorne fallbacks falsos apenas para fazer o build passar.

## 3. Arquitetura Modular e Padrões de Alta Qualidade
- **Separação Limpa:** Mantenha rotas de API, controllers, serviços e componentes de interface desacoplados.
- **Validação Estrita:** Use validação de schema (ex: Zod) para payloads externos e APIs.
- **Refatoração Incremental:** Faça mudanças estruturais por etapas com verificação de execução em cada passo.

## 4. Execução Pragmática e Eficiente
- Foque em soluções práticas e robustas que funcionam de ponta a ponta.
- Garanta testes e verificações automatizadas para lógicas críticas (cálculos fiscais, RPAs e autenticação).
