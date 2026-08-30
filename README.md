# CellTech - Loja de Celulares (Projeto de Exemplo)

Este repositório contém um site estático simples construído com **HTML**, **CSS** e **JavaScript**. O objetivo é demonstrar habilidades básicas de desenvolvimento front‑end e fornecer um projeto que pode ser usado como portfólio.

## Visão Geral

O site apresenta:

- Fundo de vídeo responsivo com sobreposição
- Barra de progresso indicando o tempo de reprodução do vídeo
- Navegação fixa com links de ancoragem
- Seções de produtos, vídeos, serviços e contato
- Formulário de contato funcional (sem back‑end)
- Layout adaptável para dispositivos móveis

## Estrutura do Projeto

```
/meu-primeiro-site.
├── index.html       # Página principal (HTML puro)
├── css/
│   └── style.css    # Estilos globais
├── js/
│   └── app.js       # Script de controle do vídeo
├── README.md        # Documentação
└── .gitignore       # Arquivos ignorados pelo Git
```

## Como testar localmente

1. Clone o repositório (o nome no GitHub termina com ponto):
   ```bash
   git clone https://github.com/vhsoliveira895-creator/meu-primeiro-site.
   cd meu-primeiro-site.
   ```

2. Abra `index.html` diretamente em um navegador ou execute um servidor HTTP simples:
   ```bash
   # Python 3
   python3 -m http.server 8000
   # navegue para http://localhost:8000
   ```

3. Verifique se o vídeo é carregado (use o link de fallback remoto se não tiver um local).

## Implantação no GitHub Pages

O site está no GitHub Pages (branch `main`, pasta `/`):

- https://vhsoliveira895-creator.github.io/meu-primeiro-site./
- se o ponto no nome do repositório atrapalhar o endereço, use também: https://vhsoliveira895-creator.github.io/meu-primeiro-site/

## Tecnologias utilizadas

- HTML5
- CSS3 (custom properties, flexbox, grid)
- JavaScript (ES6)
- Google Fonts (Outfit)

## Possíveis melhorias

- Adicionar backend para envio de formulário
- Otimizar carregamento de vídeo e imagens
- Incluir build tool (Gulp, Webpack) ou migrar para framework
- Criar sistema de rotas com SPA

---

> Este projeto foi organizado para servir como um exemplo simples e clean para recrutadores ou empregadores interessados nas minhas habilidades de front-end.
