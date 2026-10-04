import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "@/components/selia/card";
import { Button } from "@/components/selia/button";
import { Separator } from "@/components/selia/separator";
import { StepIndicator } from "./StepIndicator";
import { Step1Upload } from "./Step1Upload";
import { Step2Review } from "./Step2Review";
import { Step3Result } from "./Step3Result";
import { ReResolvePanel } from "./ReResolvePanel";
import { useImport } from "@/hooks/useImport";
import { homePath, useUiStore } from "@/store/uiStore";

export function ImportWizard() {
  const navigate = useNavigate();
  const showDashboard = useUiStore((s) => s.showDashboard);
  const {
    step,
    files,
    groups,
    needsBrand,
    errors,
    isParsing,
    parsingMessage,
    isImporting,
    progress,
    results,
    importError,
    canContinue,
    addFiles,
    removeFile,
    assignBrand,
    goToStep,
    goNext,
    goBack,
    reset,
  } = useImport();

  function handleView() {
    reset();
    navigate(homePath(showDashboard));
  }

  const continueLabel =
    step === 2 ? `Confirm Import (${groups.length} batch${groups.length > 1 ? "es" : ""})` : "Continue";

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-6">
          <StepIndicator step={step} onStepClick={goToStep} />
          <Separator />

          {step === 1 && (
            <Step1Upload
              files={files}
              errors={errors}
              isParsing={isParsing}
              parsingMessage={parsingMessage}
              onAddFiles={addFiles}
              onRemoveFile={removeFile}
              onAssignBrand={assignBrand}
            />
          )}
          {step === 2 && <Step2Review groups={groups} />}
          {step === 3 && (
            <Step3Result
              isImporting={isImporting}
              progress={progress}
              results={results}
              importError={importError}
              viewLabel={showDashboard ? "View Dashboard" : "View Retention"}
              onImportMore={reset}
              onView={handleView}
            />
          )}

          {step < 3 && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={goBack} disabled={step === 1 || isParsing}>
                Back
              </Button>
              <div className="flex items-center gap-3">
                {step === 1 && needsBrand.length > 0 && (
                  <span className="text-xs text-amber-600">
                    Choose the brand for {needsBrand.length} file{needsBrand.length > 1 ? "s" : ""} first
                  </span>
                )}
                <Button variant="primary" onClick={goNext} disabled={!canContinue}>
                  {continueLabel}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {step === 1 && <ReResolvePanel />}
    </div>
  );
}
