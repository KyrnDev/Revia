import config from '@antfu/eslint-config';

export default config({
	typescript: true,
	vue: true,
	html: true,
	css: true,
	regexp: false,
	stylistic: {
		indent: 'tab',
		quotes: 'single',
		semi: true,
	},
	ignores: [
		'*.d.ts',
		'**/*.json',
		'**/*.md',
		'eslint.config.js',
		'.vscode/',
		'node_modules/',
		'dist/',
		'build/',
		'out/',
		'coverage/',
		'.github',
	],
}, {
	rules: {
		'no-console': 0,
		'style/arrow-parens': 0,
		'antfu/if-newline': 0,
		'antfu/consistent-chaining': 0,
		'antfu/top-level-function': 0,
		'perfectionist/sort-imports': 0,
		'perfectionist/sort-named-imports': 0,
		'jsonc/sort-keys': 0,
	},
},

// ------------ STANDARD RULES ------------
{
	files: [
		'packages/*/src/**/*',
	],
	rules: {
		'import/consistent-type-specifier-style': 0,
		'no-console': 0,
		'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
		'no-use-before-define': 0,
		'no-useless-constructor': 0,
		'scss/vendorPrefix': 0,
		'func-call-spacing': 0,
		'no-new': 0,
		'no-cond-assign': 0,
		'array-bracket-spacing': 0,
		'prefer-promise-reject-errors': 0,
		'n/no-callback-literal': 0,
		'no-tabs': 0,
		'no-useless-return': 0,
		'operator-linebreak': ['error', 'before'],
		'keyword-spacing': ['error', {
				overrides: {
					catch: {
						before: true,
						after: true,
					},
				},
			},
		],
		'no-trailing-spaces': ['error', {
			ignoreComments: true,
			skipBlankLines: false,
		}],
		'space-before-function-paren': ['error', {
			anonymous: 'never',
			named: 'never',
			asyncArrow: 'always',
		}],
		'comma-dangle': ['error', {
			arrays: 'always-multiline',
			objects: 'always-multiline',
			imports: 'always-multiline',
			exports: 'always-multiline',
			functions: 'always-multiline',
		}],
	},
},

// ------------ STYLISTIC RULES ------------
{
	files: [
		'packages/*/src/**/*',
	],
	rules: {
		'import/no-self-import': 0,
		'style/space-before-function-paren': 0,
		'style/padded-blocks': 0,
		'style/space-infix-ops': 0,
		'style/quote-props': ['error', 'consistent-as-needed'],
		'style/arrow-parens': ['error', 'as-needed'],
		'style/array-bracket-spacing': ['error', 'never', {
			singleValue: false,
			objectsInArrays: false,
			arraysInArrays: false,
		}],
		'style/member-delimiter-style': ['error', {
			multilineDetection: 'brackets',
			singleline: {
				delimiter: 'comma',
				requireLast: false,
			},
			multiline: {
				delimiter: 'comma',
				requireLast: true,
			},
		}],
		'style/keyword-spacing': ['error', {
			before: true,
			after: true,
			overrides: {
				catch: { before: true, after: true },
			},
		}],
		'style/brace-style': ['error', '1tbs', {
			allowSingleLine: true,
		}],
		'unicorn/consistent-function-scoping': 0,
		'regexp/optimal-quantifier-concatenation': 0,
	},
},

// ------------ TYPESCRIPT RULES ------------
{
	files: [
		'packages/*/src/**/*.ts',
		'packages/*/src/**/*.tsx',
		'packages/*/src/**/*.d.ts',
		'packages/*/src/**/*.vue',
	],
	rules: {
		'ts/no-use-before-define': 0,
		'ts/no-unused-expressions': 0,
		'ts/consistent-type-definitions': 0,
		'ts/no-explicit-any': 0,
		'ts/explicit-member-accessibility': ['error'],
		'ts/interface-name-prefix': 0,
		'ts/camelcase': 0,
		'ts/no-useless-constructor': ['error'],
		'ts/explicit-module-boundary-types': 0,
		'ts/consistent-type-imports': ['error'],
		'ts/no-unused-vars': ['error', {
			varsIgnorePattern: 'ignore',
			argsIgnorePattern: 'ignore',
		}],
		'ts/ban-ts-comment': ['error', {
			'ts-expect-error': 'allow-with-description',
			'ts-ignore': 'allow-with-description',
			'ts-nocheck': 'allow-with-description',
			'ts-check': 'allow-with-description',
			minimumDescriptionLength: 25,
		}],
		'ts/naming-convention': ['error',
			{
				selector: 'default',
				format: ['PascalCase', 'camelCase', 'snake_case', 'UPPER_CASE'],
				leadingUnderscore: 'forbid',
			},
			{
				selector: 'function',
				format: ['PascalCase', 'camelCase'],
				leadingUnderscore: 'forbid',
			},
			{
				selector: 'variable',
				format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
				leadingUnderscore: 'allow',
			},
			{
				selector: 'memberLike',
				format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
				leadingUnderscore: 'allow',
			},
			{
				selector: 'interface',
				format: ['PascalCase'],
				custom: {
					regex: '^I[A-Z]',
					match: true,
				},
			},
			{
				selector: 'property',
				format: null,
				filter: {
					regex: '[-]',
					match: true,
				},
			},
		],
	},
},

// ------------ VUE RULES ------------
{
	files: [
		'packages/*/src/**/*.vue',
	],
	rules: {
		'style/indent': 0,
		'vue/block-order': ['error', {
			order: [['template', 'script'], 'style'],
		}],
		'vue/no-v-text-v-html-on-component': 0,
		'vue/no-v-html': 0,
		'vue/no-multiple-template-root': 0,
		'vue/multi-word-component-names': 0,
		'vue/html-self-closing': 0,
		'vue/no-dupe-keys': 0,
		'vue/quote-props': 0,
		'vue/multiline-html-element-content-newline': ['error', {
			allowEmptyLines: true,
		}],
		'vue/max-attributes-per-line': ['error', {
			singleline: 5,
			multiline: 1,
		}],
		'vue/html-indent': ['error', 'tab', {
			attribute: 1,
			baseIndent: 1,
		}],
		'vue/script-indent': ['error', 'tab', {
			baseIndent: 1,
			switchCase: 1,
		}],
	},
},

// ------------ TEST RULES ------------
{
	files: [
		'packages/*/src/**/*.spec.ts',
	],
	rules: {
		'test/prefer-lowercase-title': 0,
		'ts/naming-convention': 0,
	},
},
);
