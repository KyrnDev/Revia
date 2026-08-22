export const validateSize = (value: string) => {
	return [
		'xss',
		'xs',
		'sm',
		'md',
		'lg',
		'xl',
		'xxl',
	].includes(value);
};

export const validateTheme = (value: string) => {
	return [
		'primary',
		'secondary',
		'success',
		'danger',
		'warning',
		'info',
		'light',
		'dark',
	].includes(value);
};
