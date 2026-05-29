from setuptools import setup, find_packages

setup(
    name='this.me',
    version='0.1.2',
    author='suiGn',
    description='Identity Declaration of this.me.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    packages=find_packages(),
    classifiers=[
        'Programming Language :: Python :: 3',
    ],
    python_requires='>=3.6',
)