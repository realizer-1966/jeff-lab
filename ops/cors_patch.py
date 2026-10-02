# jeff-serve에 CORS 미들웨어 추가 — workers.dev PWA에서 브라우저 fetch 허용용
# 사용: uv run python cors_patch.py  (repo root에서 — src/jeff/server.py를 직접 수정)
import re
from pathlib import Path

p = Path("src/jeff/server.py")
s = p.read_text(encoding="utf-8")
if "CORSMiddleware" in s:
    print("이미 CORS 패치 적용됨 — 스킵")
else:
    # import 추가
    s = s.replace(
        "from starlette.middleware.base import RequestResponseEndpoint",
        "from starlette.middleware.base import RequestResponseEndpoint\nfrom starlette.middleware.cors import CORSMiddleware",
    )
    # app 생성 직후 미들웨어 추가
    s = s.replace(
        'app = FastAPI(title="Jeff", version="0.2.0", lifespan=lifespan)',
        'app = FastAPI(title="Jeff", version="0.2.0", lifespan=lifespan)\n'
        'app.add_middleware(\n'
        '    CORSMiddleware,\n'
        '    allow_origins=["*"],\n'
        '    allow_credentials=False,\n'
        '    allow_methods=["*"],\n'
        '    allow_headers=["*"],\n'
        ')',
    )
    p.write_text(s, encoding="utf-8")
    print("CORS 패치 완료 — allow_origins=['*'] (tailnet 내부 전용이라 개방 무해)")
