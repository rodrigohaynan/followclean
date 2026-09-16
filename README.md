# FollowClean

FollowClean é um projeto para analisar relacionamentos do Instagram a partir dos dados exportados pelo próprio usuário, aplicar regras de limpeza e montar uma fila assistida de revisão/unfollow.

## Objetivo do MVP

1. Importar o arquivo oficial exportado pelo Instagram.
2. Identificar seguidores, seguindo, recíprocos e quem não segue de volta.
3. Aplicar regras configuráveis.
4. Criar uma fila de limpeza assistida.
5. Evoluir depois para uma extensão Chrome vinculada ao painel.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- Supabase
- Netlify
- Extensão Chrome (fase posterior)

> O sistema não deve solicitar a senha do Instagram nem tentar contornar limitações, bloqueios ou mecanismos antiabuso da plataforma.
