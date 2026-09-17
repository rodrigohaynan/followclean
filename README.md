# FollowClean

FollowClean analisa relacionamentos do Instagram a partir dos dados exportados pelo próprio usuário, aplica regras de limpeza e prepara uma fila assistida de revisão/unfollow.

## MVP atual

1. Importar o arquivo oficial exportado pelo Instagram.
2. Identificar seguidores, seguindo, recíprocos e quem não segue de volta.
3. Salvar snapshots localmente no navegador com IndexedDB.
4. Comparar importações para mostrar novos seguidores e quem deixou de seguir.
5. Evoluir para lista protegida, regras configuráveis e fila de limpeza assistida.
6. Evoluir depois para uma extensão Chrome vinculada ao painel.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- IndexedDB no navegador
- Netlify
- Extensão Chrome (fase posterior)

O MVP atual não depende de banco externo. O sistema não solicita a senha do Instagram nem tenta contornar limitações, bloqueios ou mecanismos antiabuso da plataforma.
