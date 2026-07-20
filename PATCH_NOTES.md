# BPS Standard Order Form UX patch

Replace only:

- public/index.html
- public/app.js
- public/styles.css

Changes:

- adds a strong visible border to every fillable quantity position;
- retains grey blocked positions;
- separates LENGTH and mm into separate matrix header rows;
- corrects Multi 4 and Multi 3 with explicit Board Thickness and Board Width axes;
- automatically saves quantities, notes, active floor and edit mode in localStorage;
- restores the browser draft after an accidental close or refresh;
- clears the saved draft after successful submission;
- Enter moves to the next quantity box and Shift+Enter moves backwards.

Drafts are stored only in the current browser/device. No D1 migration is required.
