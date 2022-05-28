import { useRouter } from 'next/router';
import {
  BaseSyntheticEvent,
  FormEvent,
  FormEventHandler,
  FormHTMLAttributes,
  forwardRef,
  useCallback,
} from 'react';

import { HttpMethod } from '../http-methods';
import { useLatestRef } from '../lib/use-latest-ref';
import {
  getFormSubmitter,
  isButtonElement,
  isFormElement,
  isInputElement,
  isValidFormSubmitter,
} from './dom';
import { FormStateWithHelpers } from './helpers';
import { useFormStoreSubmit } from './store';

export type FormProps<Data> = {
  /**
   *  The method to use for form submissions. `get` appends the form-data to the
   *  URL in name/value pairs, while others send the form-data as an HTTP post
   *  transaction. Defaults to `post`.
   */
  method?: HttpMethod | Uppercase<HttpMethod>;
  /**
   * A callback that's invoked on form submission. Call `event.preventDefault()`
   * if you don't want Form to handle your submission. For example to abort in
   * case of validation errors.
   *
   * @param formData the data that was entered in the form
   */
  onSubmit?: FormEventHandler<HTMLFormElement>;

  /**
   * Called when the form is successfully submitted.
   * @param state The resulting form state
   */
  onSuccess?: (state: FormStateWithHelpers<Data>) => void;

  /**
   * Called if an error occured during form submission.
   * @param state The resulting form state
   */
  onError?: (state: FormStateWithHelpers<Data>) => void;
} & Omit<
  FormHTMLAttributes<HTMLFormElement>,
  'onSubmit' | 'onError' | 'method'
>;

function FormComponent<Data>(
  {
    method,
    action,
    encType,
    onSubmit,
    onSuccess,
    onError,
    ...props
  }: FormProps<Data>,
  ref: React.Ref<HTMLFormElement>,
) {
  const submit = useFormStoreSubmit();
  const router = useRouter();
  const onSuccessRef = useLatestRef(onSuccess);
  const onErrorRef = useLatestRef(onError);

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      onSubmit?.(event);
      if (event.defaultPrevented) return;

      event.preventDefault();

      // <button>/<input type="submit"> may override attributes of <form>
      const submitter = getFormSubmitter(event);
      const form = submitter ? submitter.form : event.currentTarget;

      if (!form) {
        throw new Error('Cannot submit a <button> without a <form>');
      }

      if (submitter && !isValidFormSubmitter(submitter)) {
        throw new Error(
          'Cannot submit element that is not <form>, <button>, or <input type="submit|image">',
        );
      }

      const formData: FormData = new FormData(form);

      const formMethod =
        (submitter?.getAttribute('formmethod') as HttpMethod) ||
        (form.getAttribute('method') as HttpMethod) ||
        method ||
        'post';

      const formAction =
        (submitter?.getAttribute('formaction') as HttpMethod) ||
        (form.getAttribute('action') as HttpMethod) ||
        action ||
        location.href.split('?')[0];

      // Include name + value from the submitter
      if (submitter?.name) {
        formData.set(submitter.name, submitter.value);
      }

      console.log('submit', formData, formAction, formMethod);
      submit({
        name: props.name,
        router,
        formData,
        formAction,
        method: formMethod,

        // need to wrap the callbacks like this so the latest ref value is accessed
        // at the time the callbacks are invoked, otherwise we could pass in a stale callback
        onError: (state) => {
          console.log('err', state);
          onErrorRef.current?.(state as FormStateWithHelpers<Data>);
        },
        onSuccess: (state) => {
          console.log('done');
          onSuccessRef.current?.(state as FormStateWithHelpers<Data>);
        },
      });
    },
    [
      method,
      onErrorRef,
      onSubmit,
      onSuccessRef,
      action,
      props.name,
      router,
      submit,
    ],
  );

  return (
    <form
      {...props}
      ref={ref}
      action={action}
      encType={encType}
      method={method}
      onSubmit={handleSubmit}
    />
  );
}

/**
 * Replace your `form` with `Form` to submit it clientside using `fetch`, and get
 * access to the serialized form data in `usePendingSubmit()` to build a great
 * looking loading status.
 */
// the cast ensures we can use the generic on the form component
export const Form = forwardRef(FormComponent) as <Data>(
  props: FormProps<Data> & { ref?: React.Ref<HTMLFormElement> },
) => JSX.Element;
