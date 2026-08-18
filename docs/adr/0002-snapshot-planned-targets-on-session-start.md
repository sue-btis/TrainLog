# Snapshot planned targets when an Exercise Session starts

When an exercise is started, its planned targets — sets, rep range, RIR range, rest and
progression rule — are copied into the Exercise Session. History therefore never reads
its plan back out of the Routine.

## Considered Options

Referencing the Planned Exercise by id was the obvious approach, but it means any later
edit to a template retroactively rewrites what past Sessions claim was planned, which
directly contradicts the product's separation of planned and actual. Copy-on-write
versioning of Planned Exercises preserves truth too, but adds lineage, version
resolution and a class of rows that only exist to be pointed at by old data.

## Consequences

Templates become safely editable, so no Routine versioning is needed. A past Session
renders its planned-versus-actual view entirely from itself, with no join into Routine
data that may since have changed. Progression is deliberately scoped by Exercise rather
than by Planned Exercise, so that re-importing a corrected file does not reset a
lifter's history.
