# MedAtlas license and third-party notices

## MedAtlas source code

Copyright (c) 2026 larrycodes80

The original MedAtlas source code in this repository is licensed under the MIT License:

~~~text
MIT License

Copyright (c) 2026 larrycodes80

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
~~~

The MIT grant covers original MedAtlas code only. It does not relicense third-party packages, model weights, fonts, native tools, or artwork.

## Third-party software inventory

The repository commits dependency manifests, not backend/.venv, frontend/node_modules, model weights, or Ollama model blobs. When dependencies or models are installed, their upstream license terms apply. The versions below are the versions used and documented by this checkout.

### Python runtime dependencies

| Component | Version | License / required treatment | Upstream |
|---|---:|---|---|
| FastAPI | 0.142.1 | MIT | https://github.com/fastapi/fastapi |
| Uvicorn | 0.54.0 | BSD-3-Clause | https://github.com/encode/uvicorn |
| python-multipart | 0.0.32 | Apache-2.0 | https://github.com/Kludex/python-multipart |
| PyMuPDF | 1.28.2 | **Dual licensed: AGPL-3.0 or Artifex commercial license** | https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright |
| pytesseract | 0.3.13 | Apache-2.0 | https://github.com/madmaze/pytesseract |
| Pillow | 12.3.0 | HPND | https://github.com/python-pillow/Pillow |
| sentence-transformers | 6.1.0 | Apache-2.0 | https://github.com/UKPLab/sentence-transformers |
| huggingface-hub | 1.33.0 | Apache-2.0 | https://github.com/huggingface/huggingface_hub |
| faiss-cpu | 1.15.1 | MIT | https://github.com/facebookresearch/faiss |
| httpx | 0.28.1 | BSD-3-Clause | https://github.com/encode/httpx |
| python-dotenv | 1.2.3 | BSD-3-Clause | https://github.com/theskumar/python-dotenv |

The installed ML runtime also contains PyTorch, NumPy, SciPy, scikit-learn, Transformers, Pydantic, Starlette, and transitive dependencies. Their license files are supplied by the package distributions and must be retained when those distributions are redistributed. The lockfile and backend/requirements.txt are the source of version truth for installation.

### Frontend dependencies

| Component | Locked version | License |
|---|---:|---|
| Next.js | 16.3.7 | MIT |
| React / React DOM | 19.2.8 | MIT |
| lucide-react | 1.31.0 | ISC |
| radix-ui | 1.6.7 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| clsx | 2.1.1 | MIT |
| input-otp | 1.4.2 | MIT |
| tailwind-merge | 3.6.0 | MIT |
| Tailwind CSS / @tailwindcss/postcss | 4.2.1 | MIT |
| tw-animate-css | 1.4.0 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| ESLint / eslint-config-next | 9.39.5 / 16.3.7 | MIT |
| React and Node type packages | 19.2.14 / 19.2.3 / 26.6.3 | MIT |

The complete transitive npm license and integrity data is in frontend/package-lock.json. Do not remove upstream copyright or license notices from a redistributed node_modules tree.

## Model licenses and notices

These weights are downloaded separately and are not committed to Git.

| Model | Used for | License / notice |
|---|---|---|
| Qwen/Qwen3-4B, served as Ollama qwen3:4b | Classification, evidence selection, memory extraction | Apache-2.0: https://huggingface.co/Qwen/Qwen3-4B |
| meta-llama/Llama-Guard-3-1B, served as llama-guard3:1b and customized as medatlas-guard | Input/output safety classification | Llama 3.2 Community License and Acceptable Use Policy: https://huggingface.co/meta-llama/Llama-Guard-3-1B |
| BAAI/bge-small-en-v1.5 | Local embeddings | MIT: https://huggingface.co/BAAI/bge-small-en-v1.5 |
| cross-encoder/ms-marco-MiniLM-L6-v2 | Cross-encoder reranking | Apache-2.0: https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2 |

### Llama Guard redistribution requirements

If Llama materials or a product containing them are distributed, retain Meta’s Llama 3.2 Community License and Acceptable Use Policy, and prominently display **“Built with Llama”** in the product or documentation. Retain this attribution notice with redistributed Llama materials:

> Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.

The Llama terms also restrict certain uses, require lawful handling of sensitive information, and include an additional commercial-terms threshold. Review the current Meta terms before redistributing weights or a bundled product.

## Native tools and fonts

| Component | Version / files | License / notice |
|---|---|---|
| Ollama | 0.35.0 observed | Ollama project license applies to the runtime binary: https://github.com/ollama/ollama |
| Tesseract OCR | 5.4.0.20240606; Leptonica 1.84.1 | Tesseract Apache-2.0; Leptonica BSD-style terms. If redistributing binaries, include their notices: https://github.com/tesseract-ocr/tesseract |
| DM Sans | frontend/public/fonts/dm-sans-*.ttf | SIL Open Font License 1.1; accompanying dmsans-OFL.txt is retained. |
| Oleo Script | frontend/public/fonts/oleo-script-700.ttf | SIL Open Font License 1.1; accompanying oleoscript-OFL.txt is retained. |
| Space Grotesk | frontend/public/fonts/space-grotesk-*.ttf | SIL Open Font License 1.1; accompanying spacegrotesk-OFL.txt is retained. |

## Distribution checklist

Before submitting or publishing a binary, container, installer, or hosted service, verify all of the following:

1. Choose and document the PyMuPDF option: comply with AGPL-3.0 for the combined distribution or obtain an Artifex commercial license. The MIT notice above does not replace this choice.
2. Include the applicable Python and npm license notices when redistributing installed dependencies.
3. Include the Qwen, BGE, and reranker model licenses if their weights are included.
4. Include the full Llama 3.2 Community License and Acceptable Use Policy, the required attribution, and the “Built with Llama” statement if Llama materials are included or made available.
5. Include Tesseract/Leptonica notices if native OCR binaries are included.
6. Retain the three font license files and verify the provenance and redistribution rights for frontend/public/images/medatlas-brain.png, medatlas-heart.png, and medatlas-sculpture.png. This repository contains no upstream license metadata for those image files.
7. Do not ship real patient data, generated demo records, data/medatlas.db, data/uploads/, credentials, .env files, model caches, or private session material.

This notice is an inventory based on the checked-in manifests and local installation. It does not grant rights that are not granted by an upstream copyright holder or model license.

