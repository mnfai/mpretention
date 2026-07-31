import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "@/components/selia/card";
import { Button } from "@/components/selia/button";
import { Separator } from "@/components/selia/separator";
import { StepIndicator } from "./StepIndicator";
import { Step1Brand } from "./Step1Brand";
import { Step2Upload } from "./Step2Upload";
import { Step3Mapping } from "./Step3Mapping";
import { Step4Result } from "./Step4Result";
import { useImport } from "@/hooks/useImport";

export function ImportWizard() {
  const navigate = useNavigate();
  const {
    step,
    brand,
    platform,
    files,
    error,
    isParsing,
    parsingMessage,
    isImporting,
    progress,
    result,
    importError,
    selectBrand,
    selectPlatform,
    addFiles,
    removeFile,
    goToStep,
    goNext,
    goBack,
    reset,
  } = useImport();

  const canContinue =
    (step === 1 && brand !== null && platform !== null) ||
    (step === 2 && files.length > 0 && !isParsing) ||
    step === 3;

  function handleViewDashboard() {
    reset();
    navigate("/dashboard");
  }

  return (
    <Card>
      <CardBody className="space-y-6">
        <StepIndicator step={step} onStepClick={goToStep} />
        <Separator />

        {step === 1 && (
          <Step1Brand
            brand={brand}
            platform={platform}
            onSelectBrand={selectBrand}
            onSelectPlatform={selectPlatform}
          />
        )}
        {step === 2 && platform && (
          <Step2Upload
            platform={platform}
            files={files}
            error={error}
            isParsing={isParsing}
            parsingMessage={parsingMessage}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
          />
        )}
        {step === 3 && files.length > 0 && <Step3Mapping files={files} />}
        {step === 4 && brand && platform && (
          <Step4Result
            brand={brand}
            platform={platform}
            isImporting={isImporting}
            progress={progress}
            result={result}
            importError={importError}
            onImportMore={reset}
            onViewDashboard={handleViewDashboard}
          />
        )}

        {step < 4 && (
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goBack} disabled={step === 1 || isParsing}>
              Back
            </Button>
            <Button variant="primary" onClick={goNext} disabled={!canContinue}>
              {step === 3 ? "Confirm Import" : "Continue"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
