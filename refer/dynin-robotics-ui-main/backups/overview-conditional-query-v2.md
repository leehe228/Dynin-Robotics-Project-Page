# Overview conditional-query figure backup

Backed up before the original four-mode Dynin-Robotics interaction was placed
in the Overview section.

Source location at backup time: `app/page.tsx`

```tsx
<div className="overview-figure reveal">
  <div className="figure-heading">
    <div>
      <span>Figure 1 · conditional query view</span>
      <strong>{objective.title}</strong>
    </div>
    <small>
      pass {stage + 1}/5 · target {objective.targetLabel}
    </small>
  </div>
  <div
    className="figure-scroll"
    role="tabpanel"
    id={`hero-objective-${activeObjective}`}
    aria-labelledby={`hero-objective-tab-${activeObjective}`}
    tabIndex={0}
  >
    <UnifiedQueryFigure objective={objective} stage={stage} compact />
  </div>
  <ObjectiveTabs
    active={activeObjective}
    onSelect={selectObjective}
    controlsPrefix="hero-objective"
  />
</div>
```

The supporting `UnifiedQueryFigure`, `ObjectiveTabs`, `.overview-figure`, and
related styles remain in the active source because they are reused elsewhere.
